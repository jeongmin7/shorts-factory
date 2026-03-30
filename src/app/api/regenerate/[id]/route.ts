import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runPipeline, type ImageModel } from '@/lib/pipeline'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const imageModel = (body.imageModel || 'fal') as ImageModel
  const ttsSpeed = Number(body.ttsSpeed) || 1.0
  const ttsInstruct = body.ttsInstruct || ''

  const video = await prisma.video.findUnique({ where: { id } })
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.imageModel && video.pipelineStage === 'image_gen') {
    await prisma.scene.updateMany({
      where: { videoId: id },
      data: { imageUrl: null },
    })
  }

  if ((body.ttsSpeed || body.ttsInstruct || body.voiceKo || body.voiceEn || body.aivisSpeakerId) && ['tts', 'srt', 'render'].includes(video.pipelineStage || '')) {
    await prisma.variant.updateMany({
      where: { videoId: id },
      data: { ttsUrl: null, srtUrl: null, videoUrl: null },
    })
  }

  await prisma.video.update({
    where: { id },
    data: { status: 'generating', errorMessage: null },
  })

  const ttsOptions = { speed: ttsSpeed, instruct: ttsInstruct, voiceKo: body.voiceKo || 'sohee', voiceEn: body.voiceEn || 'eric', aivisSpeakerId: body.aivisSpeakerId ? Number(body.aivisSpeakerId) : undefined }
  runPipeline(id, imageModel, [], ttsOptions)

  return NextResponse.json({ id, status: 'generating', resumeFrom: video.pipelineStage })
}
