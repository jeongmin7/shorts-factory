import { describe, it, expect } from 'vitest'
import { generateSRT } from '@/lib/pipeline/srt-generator'

describe('generateSRT', () => {
  it('should generate valid SRT format', () => {
    const scenes = [
      { text: 'First scene', durationSec: 5 },
      { text: 'Second scene', durationSec: 5 },
    ]
    const srt = generateSRT(scenes)
    expect(srt).toContain('1\n')
    expect(srt).toContain('00:00:00,000 --> 00:00:05,000')
    expect(srt).toContain('First scene')
    expect(srt).toContain('2\n')
    expect(srt).toContain('Second scene')
  })
})
