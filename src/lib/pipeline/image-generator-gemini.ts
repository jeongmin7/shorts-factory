import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export type GeminiImageModel =
  | 'gemini-2.5-flash-preview-image'
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview'

export async function generateImageGemini(
  prompt: string,
  videoId: string,
  sceneIndex: number,
  stylePrefix: string = '',
  model: GeminiImageModel = 'gemini-2.5-flash-preview-image',
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const genModel = genAI.getGenerativeModel({ model })

  const fullPrompt = stylePrefix
    ? `Generate an image: ${stylePrefix}. ${prompt}. Vertical 9:16 aspect ratio.`
    : `Generate an image: ${prompt}. Vertical 9:16 aspect ratio.`

  const result = await genModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as any,
  })

  const response = result.response
  const parts = response.candidates?.[0]?.content?.parts

  if (!parts) throw new Error('No parts in Gemini image response')

  const imagePart = parts.find((p: any) => p.inlineData)

  if (!imagePart || !(imagePart as any).inlineData) {
    throw new Error('No image data in Gemini response')
  }

  const imageData = (imagePart as any).inlineData
  const imageBuffer = Buffer.from(imageData.data, 'base64')

  const dir = path.join(UPLOAD_DIR, videoId, 'images')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, `scene-${sceneIndex}.png`)
  await fs.writeFile(filePath, imageBuffer)

  return filePath
}
