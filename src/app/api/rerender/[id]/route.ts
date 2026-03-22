import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runPipeline } from '@/lib/pipeline'

/**
 * Re-render: TTS + SRT + Video only (skip scene_split and image_gen)
 * Useful for testing subtitle sync and voice changes without re-generating images.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const video = await prisma.video.findUnique({ where: { id } })
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Clear TTS, SRT, video URLs so pipeline re-generates them
  await prisma.variant.updateMany({
    where: { videoId: id },
    data: { ttsUrl: null, srtUrl: null, videoUrl: null },
  })

  // Set pipeline stage to 'tts' so it skips scene_split and image_gen
  await prisma.video.update({
    where: { id },
    data: { status: 'generating', pipelineStage: 'tts', errorMessage: null },
  })

  runPipeline(id)

  return NextResponse.json({ id, status: 'generating', resumeFrom: 'tts' })
}
