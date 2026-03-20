import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runPipeline } from '@/lib/pipeline'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const video = await prisma.video.findUnique({ where: { id } })
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.video.update({
    where: { id },
    data: { status: 'generating', errorMessage: null },
  })

  runPipeline(id)

  return NextResponse.json({ id, status: 'generating', resumeFrom: video.pipelineStage })
}
