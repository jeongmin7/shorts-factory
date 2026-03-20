import { Composition } from 'remotion'
import { ShortsVideo, type ShortsVideoProps } from './ShortsVideo'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ShortsVideo"
      component={ShortsVideo as any}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30 * 60}
      defaultProps={{
        scenes: [],
        subtitles: [],
        audioUrl: '',
      } satisfies ShortsVideoProps}
    />
  )
}
