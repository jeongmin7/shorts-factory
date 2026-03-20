import { describe, it, expect, vi } from 'vitest'
import { splitAndTranslate } from '@/lib/pipeline/scene-splitter'

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            scenes: [
              {
                text_ko: '트럼프가 골프를 치고 있다.',
                text_en: 'Trump is playing golf.',
                text_ja: 'トランプがゴルフをしている。',
                imagePrompt: 'A cartoon caricature of a man in a red cap playing golf, exaggerated funny expression, meme style, vibrant colors, vertical composition',
              },
              {
                text_ko: '갑자기 공이 연못에 빠졌다.',
                text_en: 'Suddenly the ball fell into the pond.',
                text_ja: '突然ボールが池に落ちた。',
                imagePrompt: 'A cartoon golf ball splashing into a pond, exaggerated water splash, funny meme style, vertical composition',
              },
            ],
          }),
        },
      }),
    }),
  })),
}))

describe('splitAndTranslate', () => {
  it('should split script into scenes with translations', async () => {
    const result = await splitAndTranslate('트럼프가 골프를 치다가 공이 연못에 빠졌다.')
    expect(result.scenes).toHaveLength(2)
    expect(result.scenes[0].text_ko).toBeDefined()
    expect(result.scenes[0].text_en).toBeDefined()
    expect(result.scenes[0].text_ja).toBeDefined()
    expect(result.scenes[0].imagePrompt).toBeDefined()
  })
})
