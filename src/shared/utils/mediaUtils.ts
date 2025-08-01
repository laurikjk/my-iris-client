import {IMAGE_REGEX, VIDEO_REGEX} from "@/shared/components/embed/media/MediaEmbed"

// Utility function to check if content has image or video files
export const hasImageOrVideo = (content: string): boolean => {
  return IMAGE_REGEX.test(content) || VIDEO_REGEX.test(content)
}
