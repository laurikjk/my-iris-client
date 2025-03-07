import {NDKEvent} from "@nostr-dev-kit/ndk"
import ProxyImg from "../../ProxyImg"
import {useState} from "react"

interface CustomEmojiProps {
  match: string
  event?: NDKEvent
}

export const CustomEmojiComponent = ({match, event}: CustomEmojiProps) => {
  const [imgFailed, setImgFailed] = useState(false)
  if (!event || imgFailed) return <>{`:${match}:`}</>

  // The match is already the shortcode from the capture group
  const shortcode = match

  // Limit shortcode length to prevent abuse
  if (shortcode.length > 50) {
    return <>{`:${shortcode}:`}</>
  }

  // Find matching emoji tag
  const emojiTag = event.tags.find((tag) => {
    return tag[0] === "emoji" && tag[1] === shortcode
  })

  if (!emojiTag || !emojiTag[2]) {
    return <>{`:${shortcode}:`}</>
  }

  return (
    <ProxyImg
      width={24}
      src={emojiTag[2]}
      alt={`:${shortcode}:`}
      className="inline-block align-middle h-[1.2em] w-[1.2em] object-contain"
      onError={() => setImgFailed(true)}
    />
  )
}
