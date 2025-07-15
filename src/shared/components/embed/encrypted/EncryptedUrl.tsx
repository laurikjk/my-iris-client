import EncryptedUrlEmbed from "./EncryptedUrlEmbed"
import type {EmbedProps} from "../index"
import {ReactNode} from "react"

const ENCRYPTED_URL_REGEX = /(https?:\/\/[^\s]+\.bin#%7B%22k%22%3A[^\s]+)/i

type Embed = {
  regex: RegExp
  component: (props: EmbedProps) => ReactNode
  settingsKey?: string
  inline?: boolean
}

const EncryptedUrl: Embed = {
  regex: ENCRYPTED_URL_REGEX,
  component: ({match}: EmbedProps) => <EncryptedUrlEmbed url={match} />,
  inline: true,
}

export default EncryptedUrl
