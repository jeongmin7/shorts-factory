import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function generateImage(
  prompt: string,
  videoId: string,
  sceneIndex: number,
  seed: number = 42,
): Promise<string> {
  const apiKey = process.env.FAL_KEY!

  const response = await fetch('https://fal.run/fal-ai/z-image/turbo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: {
        width: 1080,
        height: 1920,
      },
      seed,
      num_inference_steps: 8,
      num_images: 1,
      output_format: 'png',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`fal.ai Z-Image API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const imageUrl = data.images?.[0]?.url

  if (!imageUrl) {
    throw new Error(`No image URL in response: ${JSON.stringify(data)}`)
  }

  const imageResponse = await fetch(imageUrl)
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

  const dir = path.join(UPLOAD_DIR, videoId, 'images')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, `scene-${sceneIndex}.png`)
  await fs.writeFile(filePath, imageBuffer)

  return filePath
}
