'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RerenderButton({ videoId }: { videoId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRerender = async () => {
    if (!confirm('TTS + 자막 + 영상을 다시 합성합니다. (이미지 재생성 없음)')) return
    setLoading(true)
    await fetch(`/api/rerender/${videoId}`, { method: 'POST' })
    router.refresh()
  }

  return (
    <button
      onClick={handleRerender}
      disabled={loading}
      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
    >
      {loading ? '합성중...' : '🔊 음성+자막 재합성'}
    </button>
  )
}
