import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

function getVoiceId(language: string): string {
  const voices: Record<string, string> = {
    ko: process.env.ELEVENLABS_VOICE_KO!,
    en: process.env.ELEVENLABS_VOICE_EN!,
  }
  const voiceId = voices[language]
  if (!voiceId) throw new Error(`No ElevenLabs voice configured for: ${language}`)
  return voiceId
}

export async function generateTTS(
  text: string,
  language: string,
  videoId: string,
): Promise<string> {
  const voiceId = getVoiceId(language)
  const apiKey = process.env.ELEVENLABS_API_KEY!

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())

  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, `${language}.mp3`)
  await fs.writeFile(filePath, audioBuffer)

  return filePath
}
