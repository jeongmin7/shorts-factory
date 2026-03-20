import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runPipeline } from '@/lib/pipeline'
import TelegramBot from 'node-telegram-bot-api'

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false })

export async function POST(request: NextRequest) {
  const body = await request.json()
  const callbackQuery = body.callback_query

  if (!callbackQuery) {
    return NextResponse.json({ ok: true })
  }

  const data = callbackQuery.data as string
  const [action, videoId, language] = data.split(':')

  try {
    if (action === 'approve' && language) {
      await prisma.variant.update({
        where: { videoId_language: { videoId, language } },
        data: { approved: true },
      })

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `${language.toUpperCase()} 승인 완료!`,
      })

      const variants = await prisma.variant.findMany({ where: { videoId } })
      const allApproved = variants.every((v) => v.approved)
      if (allApproved) {
        await prisma.video.update({
          where: { id: videoId },
          data: { status: 'approved' },
        })
        await bot.sendMessage(
          callbackQuery.message.chat.id,
          '✅ 모든 언어 승인 완료! 다음 스케줄에 업로드됩니다.',
        )
      }
    } else if (action === 'reject' && language) {
      await prisma.variant.update({
        where: { videoId_language: { videoId, language } },
        data: { approved: false },
      })
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `${language.toUpperCase()} 거절됨`,
      })
    } else if (action === 'regenerate') {
      const video = await prisma.video.findUnique({ where: { id: videoId } })
      if (video && video.retryCount < 3) {
        await prisma.video.update({
          where: { id: videoId },
          data: { status: 'generating', retryCount: video.retryCount + 1 },
        })
        await bot.answerCallbackQuery(callbackQuery.id, { text: '🔄 재생성 시작...' })
        runPipeline(videoId)
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ 최대 재생성 횟수(3회) 초과' })
      }
    }
  } catch {
    await bot.answerCallbackQuery(callbackQuery.id, { text: '오류가 발생했습니다.' })
  }

  return NextResponse.json({ ok: true })
}
