'use client'

import { useEffect, useState, useCallback } from 'react'
import { VideoCard } from './VideoCard'

interface VideoData {
  id: string
  title: string
  status: string
  pipelineStage: string | null
  createdAt: string
  variants: Array<{ language: string; approved: boolean; uploadedAt: string | null }>
}

export function VideoList() {
  const [videos, setVideos] = useState<VideoData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVideos = useCallback(() => {
    fetch('/api/videos')
      .then((res) => res.json())
      .then(setVideos)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchVideos()

    // 생성중인 영상이 있으면 5초마다 자동 갱신
    const interval = setInterval(() => {
      fetchVideos()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchVideos])

  if (loading) return <p className="text-gray-500">로딩중...</p>
  if (videos.length === 0) return <p className="text-gray-500">아직 영상이 없습니다.</p>

  return (
    <div className="grid gap-3">
      {videos.map((video) => (
        <VideoCard key={video.id} {...video} />
      ))}
    </div>
  )
}
