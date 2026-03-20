import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function generateImage(
  prompt: string,
  videoId: string,
  sceneIndex: number,
  seed: number = 42,
): Promise<string> {
  const apiUrl = process.env.ZIMAGE_API_URL!
  const apiKey = process.env.ZIMAGE_API_KEY!

  const response = await fetch(`${apiUrl}/api/v1/models/z-image-turbo/text-to-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        negative_prompt: 'blurry, low quality, distorted, watermark, text, realistic photo',
        width: 1080,
        height: 1920,
        seed,
        num_inference_steps: 8,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Z-Image API error: ${response.status}`)
  }

  const data = await response.json()
  const imageUrl = data.output?.results?.[0]?.url

  if (!imageUrl) throw new Error('No image URL in response')

  const imageResponse = await fetch(imageUrl)
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

  const dir = path.join(UPLOAD_DIR, videoId, 'images')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, `scene-${sceneIndex}.png`)
  await fs.writeFile(filePath, imageBuffer)

  return filePath
}
