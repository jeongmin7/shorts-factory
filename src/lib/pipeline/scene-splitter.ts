import { GoogleGenerativeAI } from '@google/generative-ai'

export interface SceneData {
  text_ko: string
  text_en: string
  text_ja: string
  imagePrompt: string
}

export interface SceneSplitResult {
  stylePrefix: string
  scenes: SceneData[]
}

const SYSTEM_PROMPT = `You are a script analyzer for YouTube Shorts. Given a Korean script about a funny story, you must:

1. Define a CONSISTENT visual style that ALL scenes will share
2. Split the script into 4-6 scenes (each scene = one visual moment)
3. Translate each scene to English and Japanese
4. Generate an image prompt for each scene

CRITICAL RULES FOR VISUAL CONSISTENCY:
- First, create a "stylePrefix" that defines the EXACT art style, color palette, character appearance, and rendering technique. This prefix will be prepended to EVERY scene's image prompt.
- The stylePrefix should describe: art style (e.g. "2D flat cartoon illustration"), color palette (e.g. "pastel colors with bold outlines"), character design (e.g. "a round-faced man with orange hair and blue suit"), and rendering (e.g. "clean vector art, simple shapes, thick black outlines")
- Each scene's imagePrompt should ONLY describe the ACTION and SETTING of that scene, NOT the style or character appearance (those come from stylePrefix)
- Characters must be described the SAME WAY across all scenes. Pick specific visual traits (hair color, clothing, body shape) and stick to them.
- All scenes must feel like frames from the SAME cartoon/comic

Style guide:
- Cartoon/illustration + meme style mix
- Exaggerated funny expressions
- Vibrant colors
- Vertical composition (9:16 aspect ratio)
- Do NOT use real person names in prompts, use descriptive terms instead
- IMPORTANT: Keep prompts SAFE and FAMILY-FRIENDLY. No violence, gore, blood, nudity, horror, or disturbing imagery. Use lighthearted, comedic descriptions only.

Respond ONLY with valid JSON in this format:
{
  "stylePrefix": "consistent style description applied to ALL scenes, including character appearance, art style, color palette",
  "scenes": [
    {
      "text_ko": "한국어 장면 텍스트",
      "text_en": "English scene text",
      "text_ja": "日本語シーンテキスト",
      "imagePrompt": "scene-specific action and setting ONLY (style comes from stylePrefix)"
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

  if (!parsed.stylePrefix) {
    parsed.stylePrefix = '2D cartoon illustration, vibrant colors, thick outlines, exaggerated expressions, meme style, vertical composition'
  }

  return parsed
}
