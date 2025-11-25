import {EMOJI_REGEX} from "./validation"

export const isOnlyEmoji = (text: string): boolean => {
  return EMOJI_REGEX.test(text.trim())
}
