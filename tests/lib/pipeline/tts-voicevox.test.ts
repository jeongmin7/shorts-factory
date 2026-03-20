import { describe, it, expect, vi } from 'vitest'
import { generateTTSVoicevox } from '@/lib/pipeline/tts-voicevox'

global.fetch = vi.fn()
  .mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ accent_phrases: [] }),
  })
  .mockResolvedValueOnce({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as any

vi.mock('fs/promises', () => ({
  default: { writeFile: vi.fn().mockResolvedValue(undefined), mkdir: vi.fn().mockResolvedValue(undefined) },
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

describe('generateTTSVoicevox', () => {
  it('should generate Japanese TTS and return file path', async () => {
    const result = await generateTTSVoicevox('テスト', 'video-1')
    expect(result).toContain('video-1')
    expect(result).toContain('.wav')
  })
})
