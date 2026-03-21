'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ScriptForm() {
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [imageModel, setImageModel] = useState<'fal' | 'gemini'>('fal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, script, imageModel }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="트럼프의 황당한 골프 에피소드"
          className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">
          대본 ({script.length}/2000)
        </label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="대본을 입력하세요... (100~2000자)"
          rows={10}
          className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700 resize-none"
          minLength={100}
          maxLength={2000}
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">이미지 생성 모델</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setImageModel('fal')}
            className={`flex-1 p-3 rounded-lg border transition ${
              imageModel === 'fal'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <div className="font-medium">Z-Image (fal.ai)</div>
            <div className="text-xs mt-1 opacity-70">$0.01/장 | 빠름</div>
          </button>
          <button
            type="button"
            onClick={() => setImageModel('gemini')}
            className={`flex-1 p-3 rounded-lg border transition ${
              imageModel === 'gemini'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <div className="font-medium">Gemini</div>
            <div className="text-xs mt-1 opacity-70">무료 500장/일</div>
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || script.length < 100}
        className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '생성중...' : '영상 생성하기'}
      </button>
    </form>
  )
}
