import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runPipeline, type ImageModel } from '@/lib/pipeline'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, script, imageModel = 'fal', includeEnglish = false, ttsSpeed = 1.0, ttsInstruct = '', voiceKo = 'sohee', voiceEn = 'eric', aivisSpeakerId } = await request.json()

  if (!title || !script) {
    return NextResponse.json({ error: 'title and script are required' }, { status: 400 })
  }

  if (script.length < 100 || script.length > 2000) {
    return NextResponse.json({ error: 'Script must be 100-2000 characters' }, { status: 400 })
  }

  const video = await prisma.video.create({
    data: { title, script },
  })

  const extraLanguages = includeEnglish ? (['en'] as const) : []
  const ttsOptions = { speed: Number(ttsSpeed) || 1.0, instruct: ttsInstruct || '', voiceKo: voiceKo || 'sohee', voiceEn: voiceEn || 'eric', aivisSpeakerId: aivisSpeakerId ? Number(aivisSpeakerId) : undefined }
  runPipeline(video.id, imageModel as ImageModel, [...extraLanguages], ttsOptions)

  return NextResponse.json({ id: video.id, status: 'generating' })
}
