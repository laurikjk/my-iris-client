import {CustomEmojiComponent} from "./CustomEmojiComponent"

// Export the Embed configuration separately
const CustomEmoji = {
  regex: /:([a-zA-Z0-9_-]+):/g,
  component: CustomEmojiComponent,
  inline: true,
  settingsKey: "customEmoji",
}

export default CustomEmoji
