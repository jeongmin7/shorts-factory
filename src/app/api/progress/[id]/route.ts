import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const STAGE_PROGRESS: Record<string, number> = {
  scene_split: 15,
  image_gen: 40,
  tts: 55,
  srt: 65,
  render: 85,
  notify: 95,
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const video = await prisma.video.findUnique({
    where: { id },
    select: { status: true, pipelineStage: true, errorMessage: true },
  })

  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let progress = 0
  if (video.status === 'completed' || video.status === 'approved' || video.status === 'uploaded') {
    progress = 100
  } else if (video.status === 'failed') {
    progress = STAGE_PROGRESS[video.pipelineStage || ''] || 0
  } else if (video.pipelineStage) {
    progress = STAGE_PROGRESS[video.pipelineStage] || 0
  }

  const stageLabel: Record<string, string> = {
    scene_split: '장면 분할 + 번역',
    image_gen: '이미지 생성',
    tts: '음성 생성',
    srt: '자막 생성',
    render: '영상 렌더링',
    notify: '텔레그램 전송',
  }

  return NextResponse.json({
    status: video.status,
    stage: video.pipelineStage,
    stageLabel: stageLabel[video.pipelineStage || ''] || '',
    progress,
    errorMessage: video.errorMessage,
  })
}
