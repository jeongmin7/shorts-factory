import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { getAudioDuration } from '@/lib/audio-utils'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const VOICE_KO = process.env.ELEVENLABS_VOICE_KO || ''
const VOICE_EN = process.env.ELEVENLABS_VOICE_EN || ''

const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

async function synthesizeOne(text: string, voiceId: string): Promise<Buffer> {
  const res = await fetch(`${API_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`ElevenLabs TTS error: ${res.status} - ${err}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

export async function generateTTSElevenlabsPerScene(
  sceneTexts: string[],
  language: string,
  videoId: string,
): Promise<{ filePath: string; sceneDurations: number[] }> {
  const voiceId = language === 'en' ? VOICE_EN : VOICE_KO
  if (!voiceId || !API_KEY) {
    throw new Error(`ElevenLabs not configured for ${language}`)
  }

  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  // 순차 호출 (ElevenLabs rate limit 고려)
  const scenePaths: string[] = []
  const sceneDurations: number[] = []

  for (let i = 0; i < sceneTexts.length; i++) {
    const text = sceneTexts[i].trim()
    if (!text) {
      sceneDurations.push(0)
      continue
    }

    const audioBuffer = await synthesizeOne(text, voiceId)
    const scenePath = path.join(dir, `${language}_scene_${i}.mp3`)
    await fs.writeFile(scenePath, audioBuffer)

    // mp3 → wav 변환 (ffmpeg concat 호환)
    const wavPath = path.join(dir, `${language}_scene_${i}.wav`)
    execSync(`ffmpeg -y -i "${scenePath}" "${wavPath}"`, { stdio: 'pipe' })
    await fs.unlink(scenePath)

    scenePaths.push(wavPath)
    sceneDurations.push(getAudioDuration(wavPath))
  }

  // concat
  const filePath = path.join(dir, `${language}.wav`)
  if (scenePaths.length === 1) {
    await fs.rename(scenePaths[0], filePath)
  } else {
    const listPath = path.join(dir, `${language}_concat.txt`)
    await fs.writeFile(listPath, scenePaths.map((p) => `file '${path.resolve(p)}'`).join('\n'))
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${filePath}"`, { stdio: 'pipe' })
    await Promise.all([fs.unlink(listPath), ...scenePaths.map((p) => fs.unlink(p))]).catch(() => {})
  }

  return { filePath, sceneDurations }
}
