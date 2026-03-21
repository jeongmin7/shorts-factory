'use client'

import { useEffect, useState } from 'react'

interface ProgressData {
  status: string
  stage: string | null
  stageLabel: string
  progress: number
  errorMessage: string | null
}

export function ProgressBar({ videoId }: { videoId: string }) {
  const [data, setData] = useState<ProgressData | null>(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${videoId}`)
        const json = await res.json()
        setData(json)
        if (json.status !== 'generating') {
          clearInterval(interval)
        }
      } catch {}
    }, 2000)

    // 즉시 1회 실행
    fetch(`/api/progress/${videoId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})

    return () => clearInterval(interval)
  }, [videoId])

  if (!data) return null

  const isGenerating = data.status === 'generating'
  const isFailed = data.status === 'failed'
  const isComplete = data.progress === 100

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className={isFailed ? 'text-red-400' : isComplete ? 'text-green-400' : 'text-blue-400'}>
          {isFailed ? `실패: ${data.stageLabel}` : isComplete ? '완료' : data.stageLabel || '준비중...'}
        </span>
        <span className="text-gray-500">{data.progress}%</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFailed ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${data.progress}%` }}
        />
      </div>
    </div>
  )
}
