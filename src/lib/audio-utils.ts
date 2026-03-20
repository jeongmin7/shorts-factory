import { execSync } from 'child_process'

export function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf8' },
    )
    return parseFloat(result.trim())
  } catch {
    return 60
  }
}
