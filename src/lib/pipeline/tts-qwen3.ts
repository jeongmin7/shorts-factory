import fs from 'fs/promises'
import path from 'path'

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
