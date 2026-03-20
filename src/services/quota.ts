import { prisma } from '@/lib/db'

const UPLOAD_COST = 1600

function getToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

export async function canUpload(): Promise<boolean> {
  const today = getToday()
  const tracker = await prisma.quotaTracker.findUnique({
    where: { date: today },
  })
  if (!tracker) return true
  return tracker.usedUnits + UPLOAD_COST <= tracker.maxUnits
}

export async function recordUpload(): Promise<void> {
  const today = getToday()
  await prisma.quotaTracker.upsert({
    where: { date: today },
    update: { usedUnits: { increment: UPLOAD_COST } },
    create: { date: today, usedUnits: UPLOAD_COST },
  })
}
