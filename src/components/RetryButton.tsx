'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RetryButton({ videoId }: { videoId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRetry = async () => {
    setLoading(true)
    await fetch(`/api/regenerate/${videoId}`, { method: 'POST' })
    router.refresh()
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
    >
      {loading ? '재시도중...' : '🔄 재시도'}
    </button>
  )
}
