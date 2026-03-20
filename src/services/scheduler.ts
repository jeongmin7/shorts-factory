import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { uploadToYouTube } from './youtube'
import { sendSystemAlert } from './telegram'

export function startScheduler() {
  // 매일 오전 7시 KST (UTC 22:00 전날)
  cron.schedule('0 22 * * *', () => { processUploadQueue() })

  // 매일 오후 9시 KST (UTC 12:00)
  cron.schedule('0 12 * * *', () => { processUploadQueue() })

  console.log('Scheduler started: uploads at 07:00 KST and 21:00 KST')
}

async function processUploadQueue() {
  try {
    const pendingVariants = await prisma.variant.findMany({
      where: {
        approved: true,
        uploadedAt: null,
        videoUrl: { not: null },
      },
      include: { video: true },
      orderBy: { video: { createdAt: 'asc' } },
      take: 6,
    })

    for (const variant of pendingVariants) {
      try {
        const result = await uploadToYouTube(variant.id)
        if (result === null) break
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await sendSystemAlert(`업로드 실패 (${variant.language}): ${message}`)
      }
    }

    const videos = await prisma.video.findMany({
      where: { status: 'approved' },
      include: { variants: true },
    })

    for (const video of videos) {
      const allUploaded = video.variants.every((v) => v.uploadedAt !== null)
      if (allUploaded) {
        await prisma.video.update({
          where: { id: video.id },
          data: { status: 'uploaded' },
        })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await sendSystemAlert(`스케줄러 오류: ${message}`)
  }
}
