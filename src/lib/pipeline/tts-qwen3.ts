import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

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
 * Generate TTS for all scenes in one call (consistent voice).
 * Uses /synthesize_scenes which joins texts with \n and splits internally.
 * Returns the final concatenated audio path and per-scene durations.
 */
export async function generateTTSQwen3PerScene(
  sceneTexts: string[],
  language: string,
  videoId: string,
  options: TTSOptions = {},
): Promise<{ filePath: string; sceneDurations: number[] }> {
  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  const voice = language === 'en' ? (options.voiceEn || 'eric') : (options.voiceKo || 'sohee')
  const response = await fetch(`${QWEN3_TTS_URL}/synthesize_scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenes: sceneTexts, language, voice, speed: options.speed, instruct: options.instruct }),
    signal: AbortSignal.timeout(300_000),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Qwen3-TTS batch synthesis error for ${language}: ${response.status} - ${error.error}`)
  }

  const data = await response.json()
  const segments = data.segments as { audio: string; duration: number }[]
  const sceneDurations: number[] = []
  const scenePaths: string[] = []

  // Write each segment to a temp WAV file
  for (let i = 0; i < segments.length; i++) {
    const scenePath = path.join(dir, `${language}_scene_${i}.wav`)
    const audioBuffer = Buffer.from(segments[i].audio, 'base64')
    await fs.writeFile(scenePath, audioBuffer)
    scenePaths.push(scenePath)
    sceneDurations.push(segments[i].duration)
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
export interface TTSOptions {
  speed?: number
  instruct?: string
  voiceKo?: string
  voiceEn?: string
  aivisSpeakerId?: number
}

export async function generateTTSQwen3(
  text: string,
  language: string,
  videoId: string,
  options: TTSOptions = {},
): Promise<string> {
  const voice = language === 'en' ? (options.voiceEn || 'eric') : (options.voiceKo || 'sohee')
  const response = await fetch(`${QWEN3_TTS_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, voice, speed: options.speed, instruct: options.instruct }),
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
