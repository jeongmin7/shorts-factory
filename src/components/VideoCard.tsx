import { StatusBadge } from './StatusBadge'
import Link from 'next/link'

interface VideoCardProps {
  id: string
  title: string
  status: string
  pipelineStage: string | null
  createdAt: string
  variants: Array<{ language: string; approved: boolean; uploadedAt: string | null }>
}

export function VideoCard({ id, title, status, pipelineStage, createdAt, variants }: VideoCardProps) {
  return (
    <Link href={`/videos/${id}`}>
      <div className="bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-white font-medium truncate flex-1">{title}</h3>
          <StatusBadge status={status} />
        </div>
        {status === 'generating' && pipelineStage && (
          <p className="text-yellow-400 text-xs mb-2">진행: {pipelineStage}</p>
        )}
        <div className="flex gap-2 mt-2">
          {variants.map((v) => (
            <span
              key={v.language}
              className={`text-xs px-2 py-0.5 rounded ${
                v.uploadedAt ? 'bg-purple-900 text-purple-300' :
                v.approved ? 'bg-green-900 text-green-300' :
                'bg-gray-700 text-gray-400'
              }`}
            >
              {v.language.toUpperCase()}
            </span>
          ))}
        </div>
        <p className="text-gray-500 text-xs mt-2">
          {new Date(createdAt).toLocaleDateString('ko-KR')}
        </p>
      </div>
    </Link>
  )
}
