import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'

let bot: TelegramBot | null = null

function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false })
  }
  return bot
}

function getChatId(): string {
  return process.env.TELEGRAM_CHAT_ID!
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
