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

/**
 * Detect silence gaps in audio and return split points (midpoints of silence).
 * Used to find scene boundaries in continuous TTS audio.
 */
export function detectSceneBoundaries(filePath: string, expectedScenes: number): number[] {
  const duration = getAudioDuration(filePath)

  try {
    const result = execSync(
      `ffmpeg -i "${filePath}" -af silencedetect=noise=-30dB:d=0.1 -f null - 2>&1`,
      { encoding: 'utf8', shell: '/bin/zsh' },
    )

    // Parse silence_start and silence_end pairs
    const silences: { start: number; end: number }[] = []
    const lines = result.split('\n')
    let currentStart: number | null = null

    for (const line of lines) {
      const startMatch = line.match(/silence_start:\s*([\d.]+)/)
      const endMatch = line.match(/silence_end:\s*([\d.]+)/)

      if (startMatch) {
        currentStart = parseFloat(startMatch[1])
      }
      if (endMatch && currentStart !== null) {
        silences.push({ start: currentStart, end: parseFloat(endMatch[1]) })
        currentStart = null
      }
    }

    // Skip leading silence (first silence that starts at/near 0)
    const gaps = silences.filter((s) => s.start > 0.5)

    // We need (expectedScenes - 1) boundaries
    const neededBoundaries = expectedScenes - 1

    // Use the midpoint of each silence gap as the boundary
    const boundaries = gaps
      .slice(0, neededBoundaries)
      .map((s) => (s.start + s.end) / 2)

    // If we found fewer boundaries than needed, fill with equal splits
    if (boundaries.length < neededBoundaries) {
      const segmentDuration = duration / expectedScenes
      for (let i = boundaries.length; i < neededBoundaries; i++) {
        boundaries.push(segmentDuration * (i + 1))
      }
    }

    // Convert boundaries to durations: [0, b1, b2, ..., duration]
    const points = [0, ...boundaries, duration]
    const durations: number[] = []
    for (let i = 0; i < points.length - 1; i++) {
      durations.push(points[i + 1] - points[i])
    }

    return durations
  } catch {
    // Fallback: equal split
    return Array(expectedScenes).fill(duration / expectedScenes)
  }
}
