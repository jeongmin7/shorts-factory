import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { getAudioDuration } from '@/lib/audio-utils'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const QWEN3_TTS_URL = process.env.QWEN3_TTS_URL || 'http://localhost:5050'

export async function isQwen3Available(): Promise<boolean> {
  try {
    const res = await fetch(`${QWEN3_TTS_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Generate TTS for each scene separately and concatenate.
 * Returns the final audio path and per-scene durations.
 */
export async function generateTTSQwen3PerScene(
  sceneTexts: string[],
  language: string,
  videoId: string,
): Promise<{ filePath: string; sceneDurations: number[] }> {
  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  const scenePaths: string[] = []
  const sceneDurations: number[] = []

  // Generate TTS per scene
  for (let i = 0; i < sceneTexts.length; i++) {
    const text = sceneTexts[i]
    const scenePath = path.join(dir, `${language}_scene_${i}.wav`)

    const response = await fetch(`${QWEN3_TTS_URL}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Qwen3-TTS synthesis error for ${language} scene ${i}: ${response.status} - ${error.error}`)
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(scenePath, audioBuffer)

    const duration = getAudioDuration(scenePath)
    scenePaths.push(scenePath)
    sceneDurations.push(duration)
  }

  // Concatenate all scene audio files using ffmpeg
  const filePath = path.join(dir, `${language}.wav`)
  const listPath = path.join(dir, `${language}_concat.txt`)
  const listContent = scenePaths.map((p) => `file '${path.resolve(p)}'`).join('\n')
  await fs.writeFile(listPath, listContent)

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${filePath}"`,
    { stdio: 'pipe' },
  )

  // Cleanup temp files
  await Promise.all([
    fs.unlink(listPath),
    ...scenePaths.map((p) => fs.unlink(p)),
  ]).catch(() => {})

  return { filePath, sceneDurations }
}

/** Single text TTS (kept for simple use cases) */
export async function generateTTSQwen3(
  text: string,
  language: string,
  videoId: string,
): Promise<string> {
  const response = await fetch(`${QWEN3_TTS_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Qwen3-TTS synthesis error for ${language}: ${response.status} - ${error.error}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())

  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, `${language}.wav`)
  await fs.writeFile(filePath, audioBuffer)

  return filePath
}

export async function unloadQwen3Model(): Promise<void> {
  await fetch(`${QWEN3_TTS_URL}/unload`, {
    method: 'POST',
    signal: AbortSignal.timeout(5_000),
  })
}
