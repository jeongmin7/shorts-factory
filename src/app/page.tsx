import { VideoList } from '@/components/VideoList'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Shorts Factory</h1>
        <Link
          href="/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + 새 영상
        </Link>
      </div>
      <VideoList />
    </div>
  )
}
