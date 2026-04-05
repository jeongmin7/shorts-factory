import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const language = request.nextUrl.searchParams.get('state') || 'ko'

  if (!code) {
    return NextResponse.redirect(new URL('/channels?error=no_code', request.url))
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/youtube/callback`,
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // 채널 정보 가져오기
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelRes = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    })

    const ytChannel = channelRes.data.items?.[0]
    if (!ytChannel) {
      return NextResponse.redirect(new URL('/channels?error=no_channel', request.url))
    }

    // DB에 채널 + 인증정보 저장
    const channel = await prisma.channel.upsert({
      where: { language },
      update: {
        channelName: ytChannel.snippet?.title || '',
        channelId: ytChannel.id || '',
      },
      create: {
        language,
        channelName: ytChannel.snippet?.title || '',
        channelId: ytChannel.id || '',
      },
    })

    await prisma.credential.upsert({
      where: { channelId: channel.id },
      update: {
        accessToken: encrypt(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt: new Date(tokens.expiry_date!),
      },
      create: {
        channelId: channel.id,
        accessToken: encrypt(tokens.access_token!),
        refreshToken: encrypt(tokens.refresh_token!),
        expiresAt: new Date(tokens.expiry_date!),
      },
    })

    return NextResponse.redirect(new URL('/channels?success=true', request.url))
  } catch (e) {
    console.error('YouTube OAuth error:', e)
    return NextResponse.redirect(new URL('/channels?error=auth_failed', request.url))
  }
}
