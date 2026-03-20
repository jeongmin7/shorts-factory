import { GoogleGenerativeAI } from '@google/generative-ai'

export interface SceneData {
  text_ko: string
  text_en: string
  text_ja: string
  imagePrompt: string
}

export interface SceneSplitResult {
  scenes: SceneData[]
}

const SYSTEM_PROMPT = `You are a script analyzer for YouTube Shorts. Given a Korean script about a funny story, you must:

1. Split it into 4-6 scenes (each scene = one visual moment)
2. Translate each scene to English and Japanese
3. Generate an image prompt for each scene

Style guide for image prompts:
- Cartoon/illustration + meme style mix
- Exaggerated funny expressions
- Vibrant colors
- Vertical composition (9:16 aspect ratio)
- Do NOT use real person names in prompts, use descriptive terms instead
- IMPORTANT: Keep prompts SAFE and FAMILY-FRIENDLY. No violence, gore, blood, nudity, horror, or disturbing imagery. Use lighthearted, comedic descriptions only. Avoid words like: gruesome, flesh, tearing, blood, wound, death, kill, scary, horror, disturbing

Respond ONLY with valid JSON in this format:
{
  "scenes": [
    {
      "text_ko": "한국어 장면 텍스트",
      "text_en": "English scene text",
      "text_ja": "日本語シーンテキスト",
      "imagePrompt": "detailed image prompt in English"
    }
  ]
}`

export async function splitAndTranslate(script: string): Promise<SceneSplitResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: `Script:\n${script}` },
  ])

  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse Gemini response as JSON')

  const parsed: SceneSplitResult = JSON.parse(jsonMatch[0])

  if (!parsed.scenes || parsed.scenes.length === 0) {
    throw new Error('No scenes generated')
  }

  return parsed
}
