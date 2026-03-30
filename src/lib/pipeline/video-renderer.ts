import { bundle } from '@remotion/bundler'
import { renderMedia, getCompositions } from '@remotion/renderer'
import path from 'path'
import fs from 'fs/promises'
import type { ShortsVideoProps, SceneInput, SubtitleInput } from '@/remotion/ShortsVideo'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

interface SceneWithText {
  imageUrl: string
  text: string
}

interface ChunkSubtitle {
  text: string
  durationSec: number
}

export function buildRenderProps(
  scenes: SceneWithText[],
  audioDurationSec: number,
  sceneDurations?: number[],
  chunkSubtitles?: ChunkSubtitle[],
): ShortsVideoProps {
  const fps = 30
  const totalFrames = Math.ceil(audioDurationSec * fps)

  // 이미지 전환: sceneDurations 사용 (없으면 균등 분할)
  let sceneInputs: SceneInput[]
  if (sceneDurations && sceneDurations.length === scenes.length) {
    const rawFrames = sceneDurations.map((d) => Math.max(1, Math.round(d * fps)))
    const sumFrames = rawFrames.reduce((a, b) => a + b, 0)
    rawFrames[rawFrames.length - 1] += totalFrames - sumFrames
    rawFrames[rawFrames.length - 1] = Math.max(1, rawFrames[rawFrames.length - 1])

    sceneInputs = scenes.map((scene, i) => ({
      imageUrl: scene.imageUrl,
      durationInFrames: rawFrames[i],
    }))
  } else {
    const framesPerScene = Math.floor(totalFrames / scenes.length)
    sceneInputs = scenes.map((scene, i) => ({
      imageUrl: scene.imageUrl,
      durationInFrames: i === scenes.length - 1
        ? totalFrames - framesPerScene * (scenes.length - 1)
        : framesPerScene,
    }))
  }

  // 자막: chunkSubtitles 사용 (없으면 장면 단위)
  let subtitles: SubtitleInput[]
  if (chunkSubtitles && chunkSubtitles.length > 0) {
    let frameOffset = 0
    subtitles = chunkSubtitles.map((chunk) => {
      const frames = Math.max(1, Math.round(chunk.durationSec * fps))
      const sub = { text: chunk.text, startFrame: frameOffset, endFrame: frameOffset + frames - 1 }
      frameOffset += frames
      return sub
    })
  } else {
    let frameOffset = 0
    subtitles = scenes.map((scene, i) => {
      const sub = {
        text: scene.text,
        startFrame: frameOffset,
        endFrame: frameOffset + sceneInputs[i].durationInFrames - 1,
      }
      frameOffset += sceneInputs[i].durationInFrames
      return sub
    })
  }

  return {
    scenes: sceneInputs,
    subtitles,
    audioUrl: '',
  }
}

export async function renderVideo(
  videoId: string,
  language: string,
  scenes: SceneWithText[],
  audioPath: string,
  audioDurationSec: number,
): Promise<string> {
  const entryPoint = path.resolve('./src/remotion/index.ts')
  const bundled = await bundle({ entryPoint })

  const assetDir = path.join(bundled, 'assets')
  await fs.mkdir(assetDir, { recursive: true })

  const mappedScenes = await Promise.all(
    scenes.map(async (s, i) => {
      const srcPath = path.resolve(s.imageUrl)
      const destFileName = `scene-${i}.png`
      await fs.copyFile(srcPath, path.join(assetDir, destFileName))
      return {
        ...s,
        imageUrl: `assets/${destFileName}`,
      }
    }),
  )

  const audioFileName = `audio-${language}.wav`
  await fs.copyFile(path.resolve(audioPath), path.join(assetDir, audioFileName))

  // 장면 duration + 문장별 자막 데이터 읽기
  let sceneDurations: number[] | undefined
  let chunkSubtitles: ChunkSubtitle[] | undefined
  try {
    sceneDurations = JSON.parse(await fs.readFile(path.join(UPLOAD_DIR, videoId, 'tts', `${language}_durations.json`), 'utf-8'))
  } catch { /* 폴백: 균등 분할 */ }
  try {
    const { chunks, chunkDurations } = JSON.parse(await fs.readFile(path.join(UPLOAD_DIR, videoId, 'tts', `${language}_chunks.json`), 'utf-8'))
    chunkSubtitles = chunks.map((text: string, i: number) => ({ text, durationSec: chunkDurations[i] }))
  } catch { /* 폴백: 장면 단위 자막 */ }

  const props = buildRenderProps(mappedScenes, audioDurationSec, sceneDurations, chunkSubtitles)
  props.audioUrl = `assets/${audioFileName}`

  const compositions = await getCompositions(bundled, {
    inputProps: props as unknown as Record<string, unknown>,
  })
  const composition = compositions.find((c) => c.id === 'ShortsVideo')

  if (!composition) throw new Error('ShortsVideo composition not found')

  const outputDir = path.join(UPLOAD_DIR, videoId, 'videos')
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${language}.mp4`)

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: Math.ceil(audioDurationSec * 30),
    },
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: props as unknown as Record<string, unknown>,
  })

  return outputPath
}
