import { NextRequest, NextResponse } from 'next/server'

const QWEN3_TTS_URL = process.env.QWEN3_TTS_URL || 'http://localhost:5050'
const AIVIS_URL = process.env.AIVIS_URL || 'http://localhost:10101'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { engine, voice, language, speakerId } = body

  try {
    if (engine === 'aivis') {
      const text = 'こんにちは、この声で動画を作ってみましょう。'
      const qRes = await fetch(
        `${AIVIS_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
        { method: 'POST', signal: AbortSignal.timeout(10_000) },
      )
      if (!qRes.ok) return NextResponse.json({ error: 'Aivis query failed' }, { status: 500 })
      const query = await qRes.json()

      const sRes = await fetch(`${AIVIS_URL}/synthesis?speaker=${speakerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(30_000),
      })
      if (!sRes.ok) return NextResponse.json({ error: 'Aivis synthesis failed' }, { status: 500 })

      return new NextResponse(await sRes.arrayBuffer(), {
        headers: { 'Content-Type': 'audio/wav' },
      })
    }

    // Qwen3
    const texts: Record<string, string> = {
      ko: '안녕하세요, 이 목소리로 영상을 만들어 보세요.',
      en: 'Hello, this is a preview of the voice.',
    }
    const res = await fetch(`${QWEN3_TTS_URL}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts[language] || texts.ko, language, voice }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return NextResponse.json({ error: 'TTS preview failed' }, { status: 500 })

    return new NextResponse(await res.arrayBuffer(), {
      headers: { 'Content-Type': 'audio/wav' },
    })
  } catch {
    return NextResponse.json({ error: 'TTS server unavailable' }, { status: 503 })
  }
}
