import Embed, {EmbedProps} from "../index.ts"
import Carousel from "./Carousel.tsx"

export const IMAGE_REGEX =
  /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s#]*)?(?:#[^\s]*)?(?:\s+https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s#]*)?(?:#[^\s]*)?)*)/gi
export const VIDEO_REGEX =
  /(https?:\/\/[^\s]+?\.(?:mp4|webm|ogg|mov|m3u8)(?:\?[^\s#]*)?(?:#[^\s]*)?(?:\s+https?:\/\/[^\s]+?\.(?:mp4|webm|ogg|mov|m3u8)(?:\?[^\s#]*)?(?:#[^\s]*)?)*)/gi

const MediaEmbed: Embed = {
  settingsKey: "mediaEmbed",
  regex:
    /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov|m3u8)(?:\?[^\s#]*)?(?:#[^\s]*)?(?:\s+https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov|m3u8)(?:\?[^\s#]*)?(?:#[^\s]*)?)*)/gi,
  component: ({match, event}: EmbedProps) => {
    const urls = match.trim().split(/\s+/)
    return (
      <Carousel
        media={urls.map((url) => ({
          url,
          type: url.match(/\.(mp4|webm|ogg|mov|m3u8)(?:\?|$)/) ? "video" : "image",
        }))}
        event={event}
      />
    )
  },
}

export default MediaEmbed
