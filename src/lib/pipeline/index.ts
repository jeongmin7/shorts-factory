import { prisma } from '@/lib/db'
import { splitAndTranslate } from './scene-splitter'
import { generateImage } from './image-generator'
import { generateTTS } from './tts-elevenlabs'
import { generateTTSVoicevox } from './tts-voicevox'
import { saveSRT } from './srt-generator'
import { renderVideo } from './video-renderer'
import { withRetry } from './retry'
import { sendVideoForApproval, sendErrorNotification } from '@/services/telegram'
import { getAudioDuration } from '@/lib/audio-utils'

export async function runPipeline(videoId: string): Promise<void> {
  try {
    const video = await prisma.video.findUniqueOrThrow({
      where: { id: videoId },
    })

    // Stage 1: Scene split + translate
    await updateStage(videoId, 'scene_split')
    const { scenes } = await withRetry(() => splitAndTranslate(video.script))

    const seed = Math.floor(Math.random() * 100000)

    const createdScenes = await Promise.all(
      scenes.map((scene, i) =>
        prisma.scene.create({
          data: {
            videoId,
            order: i,
            text: scene.text_ko,
            imagePrompt: scene.imagePrompt,
          },
        }),
      ),
    )

    // Create variants
    const languages = ['ko', 'en', 'ja'] as const
    for (const lang of languages) {
      const translatedScript = scenes
        .map((s) => s[`text_${lang}`])
        .join('\n')
      await prisma.variant.create({
        data: {
          videoId,
          language: lang,
          translatedScript,
          title: video.title,
        },
      })
    }

    // Stage 2: Image generation
    await updateStage(videoId, 'image_gen')
    for (let i = 0; i < scenes.length; i++) {
      const imagePath = await withRetry(() =>
        generateImage(scenes[i].imagePrompt, videoId, i, seed),
      )
      await prisma.scene.update({
        where: { id: createdScenes[i].id },
        data: { imageUrl: imagePath },
      })
    }

    // Stage 3: TTS
    await updateStage(videoId, 'tts')
    const ttsResults: Record<string, string> = {}

    const [koTts, enTts, jaTts] = await Promise.all([
      withRetry(() => generateTTS(scenes.map((s) => s.text_ko).join(' '), 'ko', videoId)),
      withRetry(() => generateTTS(scenes.map((s) => s.text_en).join(' '), 'en', videoId)),
      withRetry(() => generateTTSVoicevox(scenes.map((s) => s.text_ja).join(' '), videoId)),
    ])

    ttsResults.ko = koTts
    ttsResults.en = enTts
    ttsResults.ja = jaTts

    for (const lang of languages) {
      await prisma.variant.update({
        where: { videoId_language: { videoId, language: lang } },
        data: { ttsUrl: ttsResults[lang] },
      })
    }

    // Stage 3.5: SRT generation
    await updateStage(videoId, 'srt')
    for (const lang of languages) {
      const audioDuration = await getAudioDuration(ttsResults[lang])
      const durationPerScene = audioDuration / scenes.length
      const srtScenes = scenes.map((s) => ({
        text: s[`text_${lang}`],
        durationSec: durationPerScene,
      }))
      const srtPath = await saveSRT(srtScenes, videoId, lang)
      await prisma.variant.update({
        where: { videoId_language: { videoId, language: lang } },
        data: { srtUrl: srtPath },
      })
    }

    // Stage 4: Render (sequential for VPS resources)
    await updateStage(videoId, 'render')
    const updatedScenes = await prisma.scene.findMany({
      where: { videoId },
      orderBy: { order: 'asc' },
    })

    for (const lang of languages) {
      const sceneTexts = scenes.map((s, i) => ({
        imageUrl: updatedScenes[i].imageUrl!,
        text: s[`text_${lang}`],
      }))

      const audioDuration = await getAudioDuration(ttsResults[lang])

      const videoPath = await withRetry(() =>
        renderVideo(videoId, lang, sceneTexts, ttsResults[lang], audioDuration),
      )

      await prisma.variant.update({
        where: { videoId_language: { videoId, language: lang } },
        data: { videoUrl: videoPath },
      })
    }

    // Stage 5: Notify via Telegram
    await updateStage(videoId, 'notify')
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'completed' },
    })

    const variants = await prisma.variant.findMany({ where: { videoId } })
    await sendVideoForApproval(videoId, video.title, variants)

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
