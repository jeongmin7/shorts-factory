import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const videos = await prisma.video.findMany({
    include: {
      variants: true,
      scenes: { orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(videos)
}
