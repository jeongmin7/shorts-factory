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

export function buildRenderProps(
  scenes: SceneWithText[],
  audioDurationSec: number,
): ShortsVideoProps {
  const fps = 30
  const totalFrames = Math.ceil(audioDurationSec * fps)
  const framesPerScene = Math.floor(totalFrames / scenes.length)

  const sceneInputs: SceneInput[] = scenes.map((scene, i) => ({
    imageUrl: scene.imageUrl,
    durationInFrames: i === scenes.length - 1
      ? totalFrames - framesPerScene * (scenes.length - 1)
      : framesPerScene,
  }))

  let frameOffset = 0
  const subtitles: SubtitleInput[] = scenes.map((scene, i) => {
    const sub = {
      text: scene.text,
      startFrame: frameOffset,
      endFrame: frameOffset + sceneInputs[i].durationInFrames - 1,
    }
    frameOffset += sceneInputs[i].durationInFrames
    return sub
  })

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

  // Remotion은 headless 브라우저에서 렌더링하므로
  // 로컬 파일을 번들 디렉토리에 복사해야 접근 가능
  const assetDir = path.join(bundled, 'assets')
  await fs.mkdir(assetDir, { recursive: true })

  // 이미지를 번들에 복사
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

  // 오디오를 번들에 복사
  const audioFileName = `audio-${language}.wav`
  await fs.copyFile(path.resolve(audioPath), path.join(assetDir, audioFileName))

  const props = buildRenderProps(mappedScenes, audioDurationSec)
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
