import { useCurrentFrame } from 'remotion'
import type { SubtitleInput } from './ShortsVideo'

interface Props {
  subtitles: SubtitleInput[]
}

export const SubtitleOverlay: React.FC<Props> = ({ subtitles }) => {
  const frame = useCurrentFrame()

  const currentSubtitle = subtitles.find(
    (sub) => frame >= sub.startFrame && frame <= sub.endFrame,
  )

  if (!currentSubtitle) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 40,
        right: 40,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: '#fff',
          fontSize: 42,
          fontWeight: 'bold',
          padding: '12px 24px',
          borderRadius: 12,
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: '90%',
        }}
      >
        {currentSubtitle.text}
      </div>
    </div>
  )
}
