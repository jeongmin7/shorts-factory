export interface ChunkMapping {
  allChunks: string[]
  sceneChunkCounts: number[]
}

function splitSentencesKoEn(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim())
  return parts.length > 0 ? parts.map((s) => s.trim()) : [text.trim()]
}

function splitSentencesJa(text: string): string[] {
  const parts = text.split(/(?<=[。！？])/).filter((s) => s.trim())
  return parts.length > 0 ? parts.map((s) => s.trim()) : [text.trim()]
}

export function chunkSceneTexts(
  sceneTexts: string[],
  language: string,
): ChunkMapping {
  const allChunks: string[] = []
  const sceneChunkCounts: number[] = []

  for (const text of sceneTexts) {
    const trimmed = text.trim()
    if (!trimmed) {
      sceneChunkCounts.push(0)
      continue
    }
    const chunks = language === 'ja' ? splitSentencesJa(trimmed) : splitSentencesKoEn(trimmed)
    allChunks.push(...chunks)
    sceneChunkCounts.push(chunks.length)
  }

  return { allChunks, sceneChunkCounts }
}

export function deriveSceneDurations(
  chunkDurations: number[],
  sceneChunkCounts: number[],
): number[] {
  const sceneDurations: number[] = []
  let offset = 0
  for (const count of sceneChunkCounts) {
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += chunkDurations[offset + i] || 0
    }
    sceneDurations.push(sum)
    offset += count
  }
  return sceneDurations
}
