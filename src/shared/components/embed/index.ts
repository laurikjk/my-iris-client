import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ReactNode} from "react"

import SpotifyPlaylist from "./spotify/SpotifyPlaylist.tsx"
import SpotifyPodcast from "./spotify/SpotifyPodcast.tsx"
import SmallThumbnail from "./media/SmallThumbnail.tsx"
import TwitchChannel from "./twitch/TwitchChannel.tsx"
import SpotifyAlbum from "./spotify/SpotifyAlbum.tsx"
import SpotifyTrack from "./spotify/SpotifyTrack.tsx"
import InlineMention from "./nostr/InlineMention.tsx"
import SoundCloud from "./soundcloud/SoundCloud.tsx"
import ApplePodcast from "./apple/ApplePodcast.tsx"
import Instagram from "./instagram/Instagram.tsx"
import CustomEmoji from "./nostr/CustomEmoji.tsx"
// import TidalPlaylist from "./tidal/TidalPlaylist"
// import TidalTrack from "./tidal/TidalTrack"
import SmallImage from "./media/SmallImage.tsx"
import AppleMusic from "./apple/AppleMusic.tsx"
import MediaEmbed from "./media/MediaEmbed.tsx"
import NostrNpub from "./nostr/NostrNpub.tsx"
import LightningUri from "./LightningUri.tsx"
import YouTube from "./youtube/YouTube.tsx"
import WavLake from "./wavlake/WavLake.tsx"
import Twitch from "./twitch/Twitch.tsx"
import TikTok from "./tiktok/TikTok.tsx"
import Nip19 from "./nostr/Nip19.tsx"
import Hashtag from "./Hashtag.tsx"
import Audio from "./Audio.tsx"
import Url from "./Url.tsx"

export type EmbedProps = {
  match: string
  index?: number
  event?: NDKEvent
  key: string
}

type Embed = {
  regex: RegExp
  component: (props: EmbedProps) => ReactNode
  settingsKey?: string
  inline?: boolean
}

export const allEmbeds = [
  Audio,
  MediaEmbed,
  YouTube,
  Instagram,
  SoundCloud,
  SpotifyTrack,
  SpotifyAlbum,
  SpotifyPodcast,
  SpotifyPlaylist,
  AppleMusic,
  ApplePodcast,
  // disable tidal again, it centers the screen on the widget on load...
  // TidalPlaylist,
  // TidalTrack,
  TikTok,
  Twitch,
  TwitchChannel,
  WavLake,
  LightningUri,
  NostrNpub,
  Nip19,
  InlineMention,
  CustomEmoji,
  Url,
  Hashtag,
]

export const mediaEmbeds = [
  Audio,
  MediaEmbed,
  YouTube,
  Instagram,
  SoundCloud,
  SpotifyTrack,
  SpotifyAlbum,
  SpotifyPodcast,
  SpotifyPlaylist,
  AppleMusic,
  ApplePodcast,
  // disable tidal again, it centers the screen on the widget on load...
  // TidalPlaylist,
  // TidalTrack,
  TikTok,
  Twitch,
  TwitchChannel,
  WavLake,
]

export const textEmbeds = allEmbeds.filter((e) => mediaEmbeds.includes(e))

export const hasMedia = (e: NDKEvent) => {
  for (const embed of mediaEmbeds) {
    if (e.content.match(embed.regex)) {
      return true
    }
  }
  return false
}

export const smallEmbeds = [
  NostrNpub,
  Hashtag,
  SmallImage,
  SmallThumbnail,
  Url,
  CustomEmoji,
  InlineMention,
  Nip19,
  LightningUri,
]

export default Embed
