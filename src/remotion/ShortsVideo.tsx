import { AbsoluteFill, Audio, Sequence } from 'remotion'
import { SubtitleOverlay } from './SubtitleOverlay'

export interface SceneInput {
  imageUrl: string
  durationInFrames: number
}

export interface SubtitleInput {
  text: string
  startFrame: number
  endFrame: number
}

export interface ShortsVideoProps {
  scenes: SceneInput[]
  subtitles: SubtitleInput[]
  audioUrl: string
}

export const ShortsVideo: React.FC<ShortsVideoProps> = ({
  scenes,
  subtitles,
  audioUrl,
}) => {
  let frameOffset = 0

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {scenes.map((scene, index) => {
        const from = frameOffset
        frameOffset += scene.durationInFrames
        return (
          <Sequence key={index} from={from} durationInFrames={scene.durationInFrames}>
            <AbsoluteFill>
              <img
                src={scene.imageUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </AbsoluteFill>
          </Sequence>
        )
      })}

      {audioUrl && <Audio src={audioUrl} />}

      <SubtitleOverlay subtitles={subtitles} />
    </AbsoluteFill>
  )
}
