import { describe, it, expect, vi } from 'vitest'
import { generateImage } from '@/lib/pipeline/image-generator'

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({
    output: { results: [{ url: 'https://example.com/image.png' }] },
  }),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
}) as any

vi.mock('fs/promises', () => ({
  default: { writeFile: vi.fn().mockResolvedValue(undefined), mkdir: vi.fn().mockResolvedValue(undefined) },
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

describe('generateImage', () => {
  it('should generate an image and return file path', async () => {
    const result = await generateImage('a cartoon cat', 'video-1', 0, 42)
    expect(result).toContain('video-1')
    expect(result).toContain('.png')
  })
})
