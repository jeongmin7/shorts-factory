'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const IMAGE_MODELS = [
  { id: 'fal', name: 'Z-Image (fal.ai)' },
  { id: 'gemini-2.5-flash-preview-image', name: 'Gemini Flash' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro' },
]

export function RetryButton({ videoId, failedStage }: { videoId: string; failedStage?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [showModelSelect, setShowModelSelect] = useState(false)
  const router = useRouter()

  const handleRetry = async (imageModel?: string) => {
    setLoading(true)
    setShowModelSelect(false)
    await fetch(`/api/regenerate/${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageModel }),
    })
    router.refresh()
  }

  // 이미지 생성 단계에서 실패한 경우 모델 선택 UI 표시
  const isImageFail = failedStage === 'image_gen'

  if (showModelSelect) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400">이미지 모델 변경:</p>
        <div className="flex flex-wrap gap-1">
          {IMAGE_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => handleRetry(m.id)}
              disabled={loading}
              className="text-xs px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleRetry()}
        disabled={loading}
        className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
      >
        {loading ? '재시도중...' : '🔄 재시도'}
      </button>
      {isImageFail && (
        <button
          onClick={() => setShowModelSelect(true)}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
        >
          모델 변경
        </button>
      )}
    </div>
  )
}
