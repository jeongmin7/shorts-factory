import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { getAudioDuration } from '@/lib/audio-utils'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const AIVIS_URL = process.env.AIVIS_URL || 'http://localhost:10101'
const AIVIS_SPEAKER_ID = Number(process.env.AIVIS_SPEAKER_ID) || 888753760

export async function isAivisAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${AIVIS_URL}/speakers`, {
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

async function synthesizeOne(text: string, speakerId: number): Promise<Buffer> {
  const queryResponse = await fetch(
    `${AIVIS_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: 'POST', signal: AbortSignal.timeout(30_000) },
  )
  if (!queryResponse.ok) {
    throw new Error(`AivisSpeech audio_query error: ${queryResponse.status}`)
  }
  const audioQuery = await queryResponse.json()

  const synthesisResponse = await fetch(
    `${AIVIS_URL}/synthesis?speaker=${speakerId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioQuery),
      signal: AbortSignal.timeout(120_000),
    },
  )
  if (!synthesisResponse.ok) {
    throw new Error(`AivisSpeech synthesis error: ${synthesisResponse.status}`)
  }
  return Buffer.from(await synthesisResponse.arrayBuffer())
}

export async function generateTTSAivisPerScene(
  sceneTexts: string[],
  videoId: string,
  speakerIdOverride?: number,
): Promise<{ filePath: string; sceneDurations: number[] }> {
  const speakerId = speakerIdOverride || AIVIS_SPEAKER_ID
  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  // 5개씩 배치 처리
  const CONCURRENCY = 5
  const audioBuffers: Buffer[] = []
  for (let i = 0; i < sceneTexts.length; i += CONCURRENCY) {
    const batch = sceneTexts.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((text) => synthesizeOne(text, speakerId)))
    audioBuffers.push(...results)
  }

  const scenePaths: string[] = []
  const sceneDurations: number[] = []

  for (let i = 0; i < audioBuffers.length; i++) {
    const scenePath = path.join(dir, `ja_scene_${i}.wav`)
    await fs.writeFile(scenePath, audioBuffers[i])
    scenePaths.push(scenePath)
    sceneDurations.push(getAudioDuration(scenePath))
  }

  const filePath = path.join(dir, 'ja.wav')
  const listPath = path.join(dir, 'ja_concat.txt')
  const listContent = scenePaths.map((p) => `file '${path.resolve(p)}'`).join('\n')
  await fs.writeFile(listPath, listContent)

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${filePath}"`,
    { stdio: 'pipe' },
  )

  await Promise.all([
    fs.unlink(listPath),
    ...scenePaths.map((p) => fs.unlink(p)),
  ]).catch(() => {})

  return { filePath, sceneDurations }
}
