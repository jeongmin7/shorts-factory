import { describe, it, expect, vi, beforeAll } from 'vitest'
import { generateTTS } from '@/lib/pipeline/tts-elevenlabs'

beforeAll(() => {
  process.env.ELEVENLABS_API_KEY = 'test-key'
  process.env.ELEVENLABS_VOICE_KO = 'voice-ko'
  process.env.ELEVENLABS_VOICE_EN = 'voice-en'
})

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
}) as any

vi.mock('fs/promises', () => ({
  default: { writeFile: vi.fn().mockResolvedValue(undefined), mkdir: vi.fn().mockResolvedValue(undefined) },
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

describe('generateTTS (ElevenLabs)', () => {
  it('should generate TTS audio and return file path', async () => {
    const result = await generateTTS('Hello world', 'en', 'video-1')
    expect(result).toContain('video-1')
    expect(result).toContain('.mp3')
  })
})
