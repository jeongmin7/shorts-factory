import { prisma } from '@/lib/db'
import Link from 'next/link'

const LANGUAGES = [
  { code: 'ko', label: '🇰🇷 한국어' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'ja', label: '🇯🇵 日本語' },
]

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const params = await searchParams
  const channels = await prisma.channel.findMany({
    include: { credential: true },
  })

  return (
    <div className="min-h-screen bg-black p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">YouTube 채널 연동</h1>
        <Link href="/" className="text-gray-400 hover:text-white text-sm">← 돌아가기</Link>
      </div>

      {params.success && (
        <div className="bg-green-900 text-green-300 p-3 rounded-lg mb-4 text-sm">
          ✅ 채널 연동 완료!
        </div>
      )}
      {params.error && (
        <div className="bg-red-900 text-red-300 p-3 rounded-lg mb-4 text-sm">
          ❌ 연동 실패: {params.error}
        </div>
      )}

      <div className="space-y-3">
        {LANGUAGES.map((lang) => {
          const channel = channels.find((c) => c.language === lang.code)
          return (
            <div key={lang.code} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-white font-medium">{lang.label}</div>
                {channel ? (
                  <div className="text-green-400 text-sm mt-1">
                    ✅ {channel.channelName}
                    {channel.credential && (
                      <span className="text-gray-500 ml-2">
                        (만료: {channel.credential.expiresAt.toLocaleDateString('ko-KR')})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm mt-1">연동 안됨</div>
                )}
              </div>
              <a
                href={`/api/youtube/connect?lang=${lang.code}`}
                className={`px-4 py-2 rounded-lg text-sm ${
                  channel
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {channel ? '재연결' : '연동하기'}
              </a>
            </div>
          )
        })}
      </div>

      <p className="text-gray-600 text-xs mt-6">
        Google 계정으로 로그인하면 해당 채널에 영상을 자동 업로드합니다.
        한 번 연동하면 토큰이 자동 갱신됩니다.
      </p>
    </div>
  )
}
