import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

interface SceneWithDuration {
  text: string
  durationSec: number
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function generateSRT(scenes: SceneWithDuration[]): string {
  let offset = 0
  return scenes
    .map((scene, i) => {
      const start = formatTime(offset)
      offset += scene.durationSec
      const end = formatTime(offset)
      return `${i + 1}\n${start} --> ${end}\n${scene.text}\n`
    })
    .join('\n')
}

export async function saveSRT(
  scenes: SceneWithDuration[],
  videoId: string,
  language: string,
): Promise<string> {
  const srt = generateSRT(scenes)
  const dir = path.join(UPLOAD_DIR, videoId, 'srt')
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${language}.srt`)
  await fs.writeFile(filePath, srt, 'utf-8')
  return filePath
}
