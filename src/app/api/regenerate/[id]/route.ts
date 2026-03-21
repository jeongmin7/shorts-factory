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

  const video = await prisma.video.findUnique({ where: { id } })
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 모델 변경 시 이미지 단계부터 다시 시작하도록 기존 이미지 삭제
  if (body.imageModel && video.pipelineStage === 'image_gen') {
    await prisma.scene.updateMany({
      where: { videoId: id },
      data: { imageUrl: null },
    })
  }

  await prisma.video.update({
    where: { id },
    data: { status: 'generating', errorMessage: null },
  })

  runPipeline(id, imageModel)

  return NextResponse.json({ id, status: 'generating', resumeFrom: video.pipelineStage })
}
