import EncryptedUrlEmbed from "./EncryptedUrlEmbed"
import type {EmbedProps} from "../index"
import {ReactNode} from "react"

const ENCRYPTED_URL_REGEX = /\b(https?:\/\/[^\s]+\.bin)\b/i

type Embed = {
  regex: RegExp
  component: (props: EmbedProps) => ReactNode
  settingsKey?: string
  inline?: boolean
}

const EncryptedUrl: Embed = {
  regex: ENCRYPTED_URL_REGEX,
  component: ({match, event}: EmbedProps) => (
    <EncryptedUrlEmbed url={match} event={event} />
  ),
  inline: true,
}

export default EncryptedUrl
