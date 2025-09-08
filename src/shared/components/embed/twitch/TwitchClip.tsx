import TwitchClipComponent from "./TwitchClipComponent.tsx"
import Embed from "../index.ts"

const TwitchClip: Embed = {
  regex: /(https?:\/\/(?:www\.)?twitch\.tv\/\S+\/clip\/\S+)/g,
  settingsKey: "enableTwitch", 
  component: ({match}) => {
    console.log("🎬 TwitchClip matched:", match)
    return <TwitchClipComponent match={match} />
  },
}

export default TwitchClip