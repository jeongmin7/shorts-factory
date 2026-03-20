import { describe, it, expect } from 'vitest'
import { buildRenderProps } from '@/lib/pipeline/video-renderer'

describe('buildRenderProps', () => {
  it('should build correct props from scenes and TTS data', () => {
    const scenes = [
      { imageUrl: '/img/0.png', text: 'Scene 1' },
      { imageUrl: '/img/1.png', text: 'Scene 2' },
    ]
    const audioDurationSec = 10
    const props = buildRenderProps(scenes, audioDurationSec)

    expect(props.scenes).toHaveLength(2)
    expect(props.subtitles).toHaveLength(2)
    expect(props.scenes[0].durationInFrames).toBe(150)
    expect(props.subtitles[0].startFrame).toBe(0)
  })
})
