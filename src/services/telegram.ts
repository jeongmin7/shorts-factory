import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { runPipeline } from '@/lib/pipeline'
import { uploadToYouTube } from './youtube'

let bot: TelegramBot | null = null

function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true })
    setupCallbackHandler(bot)
  }
  return bot
}

function getChatId(): string {
  return process.env.TELEGRAM_CHAT_ID!
}

function setupCallbackHandler(tgBot: TelegramBot) {
  tgBot.on('callback_query', async (query) => {
    const data = query.data
    if (!data) return

    const [action, videoId, language] = data.split(':')

    try {
      if (action === 'approve' && language) {
        await prisma.variant.update({
          where: { videoId_language: { videoId, language } },
          data: { approved: true },
        })
        await tgBot.answerCallbackQuery(query.id, {
          text: `${language.toUpperCase()} 승인 완료!`,
        })

        // 승인된 variant 업로드
        const approvedVariant = await prisma.variant.findUnique({
          where: { videoId_language: { videoId, language } },
        })
        if (approvedVariant) {
          try {
            const ytId = await uploadToYouTube(approvedVariant.id)
            if (ytId) {
              await tgBot.sendMessage(query.message!.chat.id, `📤 ${language.toUpperCase()} 유튜브 업로드 완료! https://youtube.com/shorts/${ytId}`)
            }
          } catch (e) {
            await tgBot.sendMessage(query.message!.chat.id, `⚠️ ${language.toUpperCase()} 업로드 실패: ${e instanceof Error ? e.message : e}`)
          }
        }

        const variants = await prisma.variant.findMany({ where: { videoId } })
        const allApproved = variants.every((v) => v.approved)
        if (allApproved) {
          await prisma.video.update({
            where: { id: videoId },
            data: { status: 'approved' },
          })
          await tgBot.sendMessage(query.message!.chat.id, '✅ 모든 언어 승인 완료!')
        }
      } else if (action === 'reject' && language) {
        await prisma.variant.update({
          where: { videoId_language: { videoId, language } },
          data: { approved: false },
        })
        await tgBot.answerCallbackQuery(query.id, {
          text: `${language.toUpperCase()} 거절됨`,
        })
      } else if (action === 'regenerate') {
        const video = await prisma.video.findUnique({ where: { id: videoId } })
        if (video && video.retryCount < 3) {
          await prisma.video.update({
            where: { id: videoId },
            data: { status: 'generating', retryCount: video.retryCount + 1 },
          })
          await tgBot.answerCallbackQuery(query.id, { text: '🔄 재생성 시작...' })
          runPipeline(videoId)
        } else {
          await tgBot.answerCallbackQuery(query.id, { text: '❌ 최대 재생성 횟수(3회) 초과' })
        }
      }
    } catch {
      await tgBot.answerCallbackQuery(query.id, { text: '오류가 발생했습니다.' })
    }
  })
}

export function buildApprovalKeyboard(videoId: string) {
  const languages = [
    { code: 'ko', label: 'KO 한국어' },
    { code: 'en', label: 'EN English' },
    { code: 'ja', label: 'JA 日本語' },
  ]

  return {
    inline_keyboard: [
      ...languages.map((lang) => [
        { text: `${lang.label} ✅`, callback_data: `approve:${videoId}:${lang.code}` },
        { text: `${lang.label} ❌`, callback_data: `reject:${videoId}:${lang.code}` },
      ]),
      [{ text: '🔄 전체 재생성', callback_data: `regenerate:${videoId}` }],
    ],
  }
}

export async function sendVideoForApproval(
  videoId: string,
  title: string,
  variants: Array<{ language: string; videoUrl: string | null }>,
): Promise<void> {
  const tgBot = getBot()
  const chatId = getChatId()

  await tgBot.sendMessage(chatId, `🎬 새 영상 생성 완료!\n\n제목: ${title}`)

  for (const variant of variants) {
    if (variant.videoUrl && fs.existsSync(variant.videoUrl)) {
      const langLabel = { ko: '🇰🇷 한국어', en: '🇺🇸 English', ja: '🇯🇵 日本語' }[variant.language] || variant.language
      await tgBot.sendVideo(chatId, variant.videoUrl, { caption: langLabel })
    }
  }

  await tgBot.sendMessage(chatId, '아래 버튼으로 승인/거절해주세요:', {
    reply_markup: buildApprovalKeyboard(videoId),
  })
}

export async function sendErrorNotification(
  videoId: string,
  error: string,
): Promise<void> {
  const tgBot = getBot()
  await tgBot.sendMessage(getChatId(), `❗ 영상 생성 실패\n\nID: ${videoId}\n에러: ${error}`)
}

export async function sendSystemAlert(message: string): Promise<void> {
  const tgBot = getBot()
  await tgBot.sendMessage(getChatId(), `⚠️ 시스템 알림\n\n${message}`)
}
