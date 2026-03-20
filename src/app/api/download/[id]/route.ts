import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import fs from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const lang = searchParams.get('lang')

  if (type === 'video' && lang) {
    const variant = await prisma.variant.findUnique({
      where: { videoId_language: { videoId: id, language: lang } },
    })
    if (!variant?.videoUrl || !fs.existsSync(variant.videoUrl)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const buffer = fs.readFileSync(variant.videoUrl)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${id}-${lang}.mp4"`,
      },
    })
  }

  if (type === 'srt' && lang) {
    const variant = await prisma.variant.findUnique({
      where: { videoId_language: { videoId: id, language: lang } },
    })
    if (!variant?.srtUrl || !fs.existsSync(variant.srtUrl)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const buffer = fs.readFileSync(variant.srtUrl)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${id}-${lang}.srt"`,
      },
    })
  }

  if (type === 'images') {
    const scenes = await prisma.scene.findMany({
      where: { videoId: id },
      orderBy: { order: 'asc' },
    })
    const index = parseInt(searchParams.get('index') || '0')
    const scene = scenes[index]
    if (!scene?.imageUrl || !fs.existsSync(scene.imageUrl)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const buffer = fs.readFileSync(scene.imageUrl)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${id}-scene-${index}.png"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
}
