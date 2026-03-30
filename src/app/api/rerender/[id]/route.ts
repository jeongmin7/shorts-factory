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
  const body = await request.json().catch(() => ({}))
  const { ttsSpeed = 1.0, ttsInstruct = '', voiceKo = 'sohee', voiceEn = 'eric', aivisSpeakerId } = body

  const video = await prisma.video.findUnique({ where: { id } })
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.variant.updateMany({
    where: { videoId: id },
    data: { ttsUrl: null, srtUrl: null, videoUrl: null },
  })

  await prisma.video.update({
    where: { id },
    data: { status: 'generating', pipelineStage: 'tts', errorMessage: null },
  })

  const ttsOptions = { speed: Number(ttsSpeed) || 1.0, instruct: ttsInstruct || '', voiceKo, voiceEn, aivisSpeakerId: aivisSpeakerId ? Number(aivisSpeakerId) : undefined }
  runPipeline(id, 'fal', [], ttsOptions)

  return NextResponse.json({ id, status: 'generating', resumeFrom: 'tts' })
}
