import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runPipeline } from '@/lib/pipeline'

/**
 * Internal trigger — localhost only, no auth required.
 * Used by cron scripts to start pipeline for a pre-created video.
 */
export async function POST(request: NextRequest) {
  // localhost만 허용
  const host = request.headers.get('host') || ''
  if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { videoId } = await request.json()
  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  const video = await prisma.video.findUnique({ where: { id: videoId } })
  if (!video) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: 'generating' },
  })

  runPipeline(videoId, 'gemini-3.1-flash-image-preview')

  return NextResponse.json({ id: videoId, status: 'generating' })
}
