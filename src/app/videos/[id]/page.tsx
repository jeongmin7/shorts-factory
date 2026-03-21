import { prisma } from '@/lib/db'
import { StatusBadge } from '@/components/StatusBadge'
import { RetryButton } from '@/components/RetryButton'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const langLabels: Record<string, string> = {
  ko: '🇰🇷 한국어',
  en: '🇺🇸 English',
  ja: '🇯🇵 日本語',
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: 'asc' } },
      variants: true,
    },
  })

  if (!video) notFound()

  return (
    <div className="min-h-screen bg-gray-950 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-gray-400 hover:text-white">← 돌아가기</Link>
        <h1 className="text-xl font-bold text-white flex-1">{video.title}</h1>
        <StatusBadge status={video.status} />
      </div>

      {video.status === 'failed' && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-red-400 text-sm">{video.errorMessage}</p>
            <p className="text-red-400/60 text-xs mt-1">실패 단계: {video.pipelineStage}</p>
          </div>
          <RetryButton videoId={id} failedStage={video.pipelineStage} />
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-gray-400 text-sm mb-2">원본 대본</h2>
          <p className="text-white whitespace-pre-wrap text-sm">{video.script}</p>
        </div>

        {video.scenes.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4">
            <h2 className="text-gray-400 text-sm mb-3">장면 ({video.scenes.length}개)</h2>
            <div className="grid grid-cols-2 gap-2">
              {video.scenes.map((scene) => (
                <div key={scene.id} className="bg-gray-800 rounded-lg p-2">
                  {scene.imageUrl && (
                    <img
                      src={`/api/download/${id}?type=images&index=${scene.order}`}
                      alt={`Scene ${scene.order + 1}`}
                      className="rounded mb-1 w-full aspect-[9/16] object-cover"
                    />
                  )}
                  <p className="text-gray-300 text-xs">{scene.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-gray-400 text-sm mb-3">언어별 영상</h2>
          <div className="space-y-3">
            {video.variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">
                    {langLabels[variant.language] || variant.language}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    variant.uploadedAt ? 'bg-purple-900 text-purple-300' :
                    variant.approved ? 'bg-green-900 text-green-300' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {variant.uploadedAt ? '업로드됨' : variant.approved ? '승인됨' : '대기중'}
                  </span>
                </div>
                {variant.videoUrl && (
                  <div className="flex gap-2">
                    <a
                      href={`/api/download/${id}?type=video&lang=${variant.language}`}
                      className="text-blue-400 text-sm hover:underline"
                    >
                      MP4
                    </a>
                    {variant.srtUrl && (
                      <a
                        href={`/api/download/${id}?type=srt&lang=${variant.language}`}
                        className="text-blue-400 text-sm hover:underline"
                      >
                        SRT
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
