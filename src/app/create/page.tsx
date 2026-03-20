import { ScriptForm } from '@/components/ScriptForm'
import Link from 'next/link'

export default function CreatePage() {
  return (
    <div className="min-h-screen bg-gray-950 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-gray-400 hover:text-white">
          ← 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-white">새 영상 만들기</h1>
      </div>
      <ScriptForm />
    </div>
  )
}
