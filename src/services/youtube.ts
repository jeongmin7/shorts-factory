import { google } from 'googleapis'
import fs from 'fs'
import { prisma } from '@/lib/db'
import { decrypt, encrypt } from '@/lib/encryption'
import { canUpload, recordUpload } from './quota'
import { sendSystemAlert } from './telegram'

async function getAuthClient(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { credential: true },
  })

  if (!channel?.credential) {
    throw new Error(`No credential for channel: ${channelId}`)
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )

  oauth2Client.setCredentials({
    access_token: decrypt(channel.credential.accessToken),
    refresh_token: decrypt(channel.credential.refreshToken),
  })

  if (new Date() >= channel.credential.expiresAt) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await prisma.credential.update({
      where: { id: channel.credential.id },
      data: {
        accessToken: encrypt(credentials.access_token!),
        refreshToken: credentials.refresh_token
          ? encrypt(credentials.refresh_token)
          : channel.credential.refreshToken,
        expiresAt: new Date(credentials.expiry_date!),
      },
    })
  }

  return oauth2Client
}

export async function uploadToYouTube(variantId: string): Promise<string | null> {
  const variant = await prisma.variant.findUniqueOrThrow({
    where: { id: variantId },
    include: { video: true },
  })

  if (!variant.videoUrl || !variant.approved) return null

  if (!(await canUpload())) {
    await sendSystemAlert(`YouTube 할당량 초과 - ${variant.language} 업로드 이연`)
    return null
  }

  const channel = await prisma.channel.findUnique({
    where: { language: variant.language },
  })

  if (!channel) {
    throw new Error(`No channel for language: ${variant.language}`)
  }

  const auth = await getAuthClient(channel.id)
  const youtube = google.youtube({ version: 'v3', auth })

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: variant.title || variant.video.title,
        description: variant.description || '',
        tags: variant.tags?.split(',') || [],
        categoryId: '24',
        defaultLanguage: variant.language,
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(variant.videoUrl),
    },
  })

  const youtubeVideoId = response.data.id!

  await prisma.variant.update({
    where: { id: variantId },
    data: { youtubeVideoId, uploadedAt: new Date() },
  })

  await recordUpload()
  return youtubeVideoId
}
