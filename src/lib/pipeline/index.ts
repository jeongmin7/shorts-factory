import { prisma } from '@/lib/db'
import { splitAndTranslate, type SceneData } from './scene-splitter'
import { generateImage } from './image-generator'
import { generateImageGemini, type GeminiImageModel } from './image-generator-gemini'
import { generateTTSAivisPerScene, isAivisAvailable } from './tts-aivis'
import { generateTTSElevenlabsPerScene } from './tts-elevenlabs'
import type { TTSOptions } from './tts-qwen3'
import { saveSRT } from './srt-generator'
import { renderVideo } from './video-renderer'
import { withRetry } from './retry'
import { sendVideoForApproval, sendErrorNotification } from '@/services/telegram'
import fs from 'fs/promises'
import path from 'path'
import { getAudioDuration } from '@/lib/audio-utils'
import { chunkSceneTexts, deriveSceneDurations } from './text-chunker'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

const STAGES = ['scene_split', 'image_gen', 'tts', 'srt', 'render', 'notify'] as const
type Stage = typeof STAGES[number]

function shouldRun(currentStage: Stage, lastFailedStage: string | null): boolean {
  if (!lastFailedStage) return true
  const currentIdx = STAGES.indexOf(currentStage)
  const failedIdx = STAGES.indexOf(lastFailedStage as Stage)
  return currentIdx >= failedIdx
}

type Language = 'ja' | 'ko' | 'en'
const BASE_LANGUAGES: Language[] = ['ja', 'ko', 'en']

export type ImageModel = 'fal' | 'gemini-2.5-flash-preview-image' | 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview'

export async function runPipeline(
  videoId: string,
  imageModel: ImageModel = 'fal',
  extraLanguages: Language[] = [],
  ttsOptions: TTSOptions = {},
): Promise<void> {
  try {
    const languages: Language[] = [...BASE_LANGUAGES, ...extraLanguages]
    const video = await prisma.video.findUniqueOrThrow({
      where: { id: videoId },
      include: {
        scenes: { orderBy: { order: 'asc' } },
        variants: true,
      },
    })

    const isResume = video.pipelineStage !== null && video.scenes.length > 0
    const lastFailedStage = video.pipelineStage

    let scenes: SceneData[]
    let dbScenes = video.scenes
    let stylePrefix = ''

    // Stage 1: Scene split + translate
    if (shouldRun('scene_split', lastFailedStage) && !isResume) {
      await updateStage(videoId, 'scene_split')
      const result = await withRetry(() => splitAndTranslate(video.script))
      scenes = result.scenes
      stylePrefix = result.stylePrefix

      const seed = Math.floor(Math.random() * 100000)
      await prisma.video.update({ where: { id: videoId }, data: { retryCount: seed } })

      // 첫 번째 장면의 imagePrompt 앞에 stylePrefix 저장 (재시도 시 복원용)
      dbScenes = await Promise.all(
        scenes.map((scene, i) =>
          prisma.scene.create({
            data: {
              videoId,
              order: i,
              text: scene.text_ko,
              imagePrompt: i === 0
                ? `[STYLE]${stylePrefix}[/STYLE]${scene.imagePrompt}`
                : scene.imagePrompt,
            },
          }),
        ),
      )

      for (const lang of languages) {
        const translatedScript = scenes.map((s) => s[`text_${lang}`]).join('\n')
        await prisma.variant.upsert({
          where: { videoId_language: { videoId, language: lang } },
          update: { translatedScript },
          create: { videoId, language: lang, translatedScript, title: video.title },
        })
      }
    } else {
      // Resume: DB에서 장면 데이터 복원
      const variants = await prisma.variant.findMany({ where: { videoId } })

      // stylePrefix 복원
      const firstScene = dbScenes[0]
      if (firstScene) {
        const styleMatch = firstScene.imagePrompt.match(/\[STYLE\](.*?)\[\/STYLE\]/)
        if (styleMatch) {
          stylePrefix = styleMatch[1]
        }
      }

      scenes = dbScenes.map((s, i) => ({
        text_ko: s.text,
        text_en: variants.find((v) => v.language === 'en')?.translatedScript.split('\n')[i] || '',
        text_ja: variants.find((v) => v.language === 'ja')?.translatedScript.split('\n')[i] || '',
        imagePrompt: s.imagePrompt.replace(/\[STYLE\].*?\[\/STYLE\]/, ''),
      }))
    }

    // Stage 2: Image generation
    if (shouldRun('image_gen', lastFailedStage)) {
      await updateStage(videoId, 'image_gen')
      const seed = video.retryCount || Math.floor(Math.random() * 100000)
      for (let i = 0; i < dbScenes.length; i++) {
        if (dbScenes[i].imageUrl) continue // 이미 생성된 이미지 스킵
        const imagePath = await withRetry(() =>
          imageModel !== 'fal'
            ? generateImageGemini(scenes[i].imagePrompt, videoId, i, stylePrefix, imageModel as GeminiImageModel)
            : generateImage(scenes[i].imagePrompt, videoId, i, seed, stylePrefix),
        )
        await prisma.scene.update({
          where: { id: dbScenes[i].id },
          data: { imageUrl: imagePath },
        })
        dbScenes[i] = { ...dbScenes[i], imageUrl: imagePath }
      }
    }

    // Stage 3: TTS
    if (shouldRun('tts', lastFailedStage)) {
      await updateStage(videoId, 'tts')
      const existingVariants = await prisma.variant.findMany({ where: { videoId } })

      for (const lang of languages) {
        const variant = existingVariants.find((v) => v.language === lang)
        if (variant?.ttsUrl) continue // 이미 생성된 TTS 스킵

        // 장면 텍스트를 문장 단위로 분할
        const sceneTexts = scenes.map((s) => s[`text_${lang}`] as string)
        const { allChunks, sceneChunkCounts } = chunkSceneTexts(sceneTexts, lang)

        let ttsResult: { filePath: string; sceneDurations: number[] }
        if (lang === 'ja') {
          // 일본어: Aivis
          const aivisAvailable = await isAivisAvailable()
          if (aivisAvailable) {
            ttsResult = await withRetry(() =>
              generateTTSAivisPerScene(allChunks, videoId, ttsOptions.aivisSpeakerId),
            )
          } else {
            console.warn('[TTS] AivisSpeech not available, skipping ja')
            continue
          }
        } else {
          // 한국어/영어: ElevenLabs (실패 시 스킵)
          try {
            ttsResult = await generateTTSElevenlabsPerScene(allChunks, lang, videoId)
          } catch (e) {
            console.warn(`[TTS] ElevenLabs failed for ${lang}: ${e instanceof Error ? e.message : e}, skipping`)
            continue
          }
        }

        // 문장별 duration → 장면별 duration 합산
        const chunkDurations = ttsResult.sceneDurations
        const sceneDurations = deriveSceneDurations(chunkDurations, sceneChunkCounts)

        const ttsDir = path.join(UPLOAD_DIR, videoId, 'tts')
        await fs.writeFile(path.join(ttsDir, `${lang}_durations.json`), JSON.stringify(sceneDurations))
        await fs.writeFile(path.join(ttsDir, `${lang}_chunks.json`), JSON.stringify({ chunks: allChunks, chunkDurations }))
        const ttsPath = ttsResult.filePath

        await prisma.variant.update({
          where: { videoId_language: { videoId, language: lang } },
          data: { ttsUrl: ttsPath },
        })
      }

    }

    // Stage 3.5: SRT generation
    if (shouldRun('srt', lastFailedStage)) {
      await updateStage(videoId, 'srt')
      const variants = await prisma.variant.findMany({ where: { videoId } })

      for (const lang of languages) {
        const variant = variants.find((v) => v.language === lang)
        if (variant?.srtUrl) continue // 이미 생성된 SRT 스킵
        if (!variant?.ttsUrl) continue // TTS 없으면 SRT 스킵

        // 문장별 duration으로 SRT 생성
        const chunksPath = path.join(UPLOAD_DIR, videoId, 'tts', `${lang}_chunks.json`)
        let srtEntries: { text: string; durationSec: number }[]
        try {
          const { chunks, chunkDurations } = JSON.parse(await fs.readFile(chunksPath, 'utf-8'))
          srtEntries = chunks.map((text: string, i: number) => ({
            text,
            durationSec: chunkDurations[i],
          }))
        } catch {
          // 폴백: 장면 단위
          const texts = scenes.map((s) => s[`text_${lang}`] as string)
          const totalDuration = getAudioDuration(variant!.ttsUrl!)
          srtEntries = texts.map((text) => ({
            text,
            durationSec: totalDuration / texts.length,
          }))
        }
        const srtPath = await saveSRT(srtEntries, videoId, lang)
        await prisma.variant.update({
          where: { videoId_language: { videoId, language: lang } },
          data: { srtUrl: srtPath },
        })
      }
    }

    // Stage 4: Render
    if (shouldRun('render', lastFailedStage)) {
      await updateStage(videoId, 'render')
      const updatedScenes = await prisma.scene.findMany({
        where: { videoId },
        orderBy: { order: 'asc' },
      })
      const variants = await prisma.variant.findMany({ where: { videoId } })

      for (const lang of languages) {
        const variant = variants.find((v) => v.language === lang)
        if (variant?.videoUrl) continue // 이미 렌더된 영상 스킵
        if (!variant?.ttsUrl) continue // TTS 없으면 렌더 스킵

        const sceneTexts = scenes.map((s, i) => ({
          imageUrl: updatedScenes[i].imageUrl!,
          text: s[`text_${lang}`],
        }))

        const audioDuration = await getAudioDuration(variant!.ttsUrl!)

        const videoPath = await withRetry(() =>
          renderVideo(videoId, lang, sceneTexts, variant!.ttsUrl!, audioDuration),
        )

        await prisma.variant.update({
          where: { videoId_language: { videoId, language: lang } },
          data: { videoUrl: videoPath },
        })
      }
    }

    // Stage 5: Notify via Telegram
    if (shouldRun('notify', lastFailedStage)) {
      await updateStage(videoId, 'notify')
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'completed' },
      })

      const variants = await prisma.variant.findMany({ where: { videoId } })
      await sendVideoForApproval(videoId, video.title, variants)
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'failed', errorMessage: message },
    })
    await sendErrorNotification(videoId, message)
  }
}

async function updateStage(videoId: string, stage: string) {
  await prisma.video.update({
    where: { id: videoId },
    data: { pipelineStage: stage },
  })
}
