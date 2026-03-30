'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const SPEED_OPTIONS = [
  { value: 1.0, label: '1.0x (기본)' },
  { value: 1.2, label: '1.2x' },
  { value: 1.4, label: '1.4x' },
  { value: 1.6, label: '1.6x' },
  { value: 1.8, label: '1.8x' },
  { value: 2.0, label: '2.0x' },
]

const QWEN3_VOICES = ['serena', 'vivian', 'uncle_fu', 'ryan', 'aiden', 'ono_anna', 'sohee', 'eric', 'dylan']

const AIVIS_SPEAKERS = [
  { id: 808373280, name: 'ほのか - ノーマル' },
  { id: 808373281, name: 'ほのか - 悲しみ' },
  { id: 808373282, name: 'ほのか - 嬉しい' },
  { id: 808373283, name: 'ほのか - 普通' },
  { id: 1310138976, name: '阿井田 茂 - ノーマル' },
  { id: 1310138977, name: '阿井田 茂 - Calm' },
  { id: 1310138979, name: '阿井田 茂 - Heavy' },
  { id: 1310138981, name: '阿井田 茂 - Shout' },
]

const IMAGE_MODELS = [
  { id: 'fal', name: 'Z-Image (fal.ai)', desc: '$0.01/장 | 빠름' },
  { id: 'gemini-2.5-flash-preview-image', name: 'Gemini Flash', desc: '무료 500장/일' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash', desc: '~$0.045/장 | 고품질' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro', desc: '~$0.134/장 | 최고 품질' },
]

export function ScriptForm() {
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [imageModel, setImageModel] = useState('fal')
  const [ttsSpeed, setTtsSpeed] = useState(1.0)
  const [ttsInstruct, setTtsInstruct] = useState('')
  const [voiceKo, setVoiceKo] = useState('sohee')
  const [voiceEn, setVoiceEn] = useState('eric')
  const [aivisSpeakerId, setAivisSpeakerId] = useState(1310138976)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handlePreview = async (engine: 'qwen3' | 'aivis', lang: string, voice: string, speakerId?: number) => {
    const key = `${engine}-${lang}`
    setPreviewLoading(key)
    try {
      const res = await fetch('/api/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, voice, language: lang, speakerId }),
      })
      if (!res.ok) throw new Error('Preview failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.hidden = false
        audioRef.current.play()
      }
    } catch {
      setError('미리듣기 실패 (TTS 서버 확인)')
    } finally {
      setPreviewLoading(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, script, imageModel, ttsSpeed, ttsInstruct, voiceKo, voiceEn, aivisSpeakerId }),
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
        <div className="grid grid-cols-2 gap-2">
          {IMAGE_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setImageModel(m.id)}
              className={`p-3 rounded-lg border transition text-left ${
                imageModel === m.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="font-medium text-sm">{m.name}</div>
              <div className="text-xs mt-1 opacity-70">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">성우 선택</label>
        <div className="space-y-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">한국어</div>
              <select
                value={voiceKo}
                onChange={(e) => setVoiceKo(e.target.value)}
                className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700"
              >
                {QWEN3_VOICES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => handlePreview('qwen3', 'ko', voiceKo)} disabled={previewLoading !== null}
              className="px-3 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm whitespace-nowrap">
              {previewLoading === 'qwen3-ko' ? '...' : '미리듣기'}
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">영어</div>
              <select
                value={voiceEn}
                onChange={(e) => setVoiceEn(e.target.value)}
                className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700"
              >
                {QWEN3_VOICES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => handlePreview('qwen3', 'en', voiceEn)} disabled={previewLoading !== null}
              className="px-3 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm whitespace-nowrap">
              {previewLoading === 'qwen3-en' ? '...' : '미리듣기'}
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">일본어 (Aivis)</div>
              <select
                value={aivisSpeakerId}
                onChange={(e) => setAivisSpeakerId(Number(e.target.value))}
                className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700"
              >
                {AIVIS_SPEAKERS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => handlePreview('aivis', 'ja', '', aivisSpeakerId)} disabled={previewLoading !== null}
              className="px-3 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm whitespace-nowrap">
              {previewLoading === 'aivis-ja' ? '...' : '미리듣기'}
            </button>
          </div>
          <audio ref={audioRef} className="w-full mt-1" controls hidden />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">음성 배속</label>
        <div className="flex gap-2">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTtsSpeed(opt.value)}
              className={`px-3 py-2 rounded-lg border text-sm transition ${
                ttsSpeed === opt.value
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">음성 스타일 (선택)</label>
        <input
          type="text"
          value={ttsInstruct}
          onChange={(e) => setTtsInstruct(e.target.value)}
          placeholder="예: 차분한 30대 여성, 밝고 활기찬 20대 남성"
          className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-700"
        />
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
