import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const VOICEVOX_URL = process.env.VOICEVOX_URL || 'http://localhost:50021'
const SPEAKER_ID = 11 // 玄野武宏 (ノーマル)

export async function generateTTSVoicevox(
  text: string,
  videoId: string,
): Promise<string> {
  const queryResponse = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
    { method: 'POST' },
  )

  if (!queryResponse.ok) {
    throw new Error(`VOICEVOX audio_query error: ${queryResponse.status}`)
  }

  const audioQuery = await queryResponse.json()

  const synthesisResponse = await fetch(
    `${VOICEVOX_URL}/synthesis?speaker=${SPEAKER_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioQuery),
    },
  )

  if (!synthesisResponse.ok) {
    throw new Error(`VOICEVOX synthesis error: ${synthesisResponse.status}`)
  }

  const audioBuffer = Buffer.from(await synthesisResponse.arrayBuffer())

  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, 'ja.wav')
  await fs.writeFile(filePath, audioBuffer)

  return filePath
}
