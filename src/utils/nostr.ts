import {NDKEvent, NDKTag} from "@nostr-dev-kit/ndk"
import {eventRegex} from "@/shared/components/embed/nostr/NostrNote"
import {decode} from "light-bolt11-decoder"
import {profileCache} from "./profileCache"
import AnimalName from "./AnimalName"
import {nip19} from "nostr-tools"
import {ndk} from "@/utils/ndk"
import {KIND_REPOST, KIND_TEXT_NOTE, KIND_ZAP_RECEIPT} from "@/utils/constants"

export function getEventReplyingTo(event: NDKEvent) {
  if (event.kind !== KIND_TEXT_NOTE) {
    return undefined
  }
  const qEvent = event.tags?.find((tag) => tag[0] === "q")?.[1]
  const replyTags =
    event.tags?.filter((tag) => tag[0] === "e" && tag[3] !== "mention") || []
  if (replyTags.length === 1 && replyTags[0][1] !== qEvent) {
    return replyTags[0][1]
  }
  const replyTag = event.tags?.find((tag) => tag[0] === "e" && tag[3] === "reply")
  if (replyTag) {
    return replyTag[1]
  }
  // If there's a root tag and it's the only e tag (besides mentions),
  // it's a direct reply to the root
  const rootTag = event.tags?.find((tag) => tag[0] === "e" && tag[3] === "root")
  if (rootTag && replyTags.length === 1) {
    return rootTag[1]
  }
  return undefined
}

export function isRepost(event: NDKEvent) {
  if (event.kind === KIND_REPOST) {
    return true
  }
  const mentionIndex = event.tags?.findIndex(
    (tag) => tag[0] === "e" && tag[3] === "mention"
  )
  if (event.kind === KIND_TEXT_NOTE && event.content === `#[${mentionIndex}]`) {
    return true
  }
  return false
}

export function getZappingUser(event: NDKEvent, npub = true) {
  const description = event.tags?.find((t) => t[0] === "description")?.[1]
  if (!description) {
    return null
  }
  let obj
  try {
    obj = JSON.parse(description)
  } catch (e) {
    return null
  }
  if (npub) {
    nip19.npubEncode(obj.pubkey)
  }
  return obj.pubkey
}

export async function getZapAmount(event: NDKEvent) {
  const invoice = event.tagValue("bolt11")
  if (invoice) {
    const decodedInvoice = decode(invoice)
    const amountSection = decodedInvoice.sections.find(
      (section) => section.name === "amount"
    )
    if (amountSection && "value" in amountSection) {
      // Convert millisatoshis to satoshis
      return Math.floor(parseInt(amountSection.value) / 1000)
    }
  }
  return 0
}

export function getEventRoot(event: NDKEvent) {
  const rootEvent = event?.tags?.find((t) => t[0] === "e" && t[3] === "root")?.[1]
  if (rootEvent) {
    return rootEvent
  }
  const quotedEvent = getQuotedEvent(event)
  // first e tag
  return event?.tags?.find((t) => t[0] === "e" && t[1] !== quotedEvent)?.[1]
}

export const getTag = (key: string, tags: NDKTag[]): string => {
  for (const t of tags) {
    if (t[0] === key) {
      return t[1]
    }
  }
  return ""
}

export const getTags = (key: string, tags: NDKTag[]): string[] => {
  const res: string[] = []
  for (const t of tags) {
    if (t[0] == key) {
      res.push(t[1])
    }
  }
  return res
}

export const fetchZappedAmount = async (event: NDKEvent): Promise<number> => {
  return new Promise((resolve) => {
    let zappedAmount = 0
    const filter = {
      kinds: [KIND_ZAP_RECEIPT],
      ["#e"]: [event.id],
    }
    try {
      const sub = ndk().subscribe(filter)

      sub?.on("event", async (event) => {
        const invoice = event.tagValue("bolt11")
        if (invoice) {
          const decodedInvoice = decode(invoice)
          const amountSection = decodedInvoice.sections.find(
            (section) => section.name === "amount"
          )
          if (amountSection && "value" in amountSection) {
            // Convert millisatoshis to satoshis
            zappedAmount = zappedAmount + Math.floor(parseInt(amountSection.value) / 1000)
          }
        }
      })
      sub?.on("eose", () => {
        sub?.stop()
        resolve(zappedAmount)
      })
    } catch (error) {
      console.warn(error)
    }
  })
}

// export const getIds = (idsMap: Map) => {
//   if (idsMap) {
//     const arrIds = Array.from(idsMap.entries())
//       .filter((entry) => entry[1] === "p")
//       .map((pTag) => pTag[0])
//     return arrIds
//   } else {
//     return []
//   }
// }

export type RawEvent = {
  id: string
  kind: number
  created_at: number
  content: string
  tags: string[][]
  sig: string
  pubkey: string
}

export const NDKEventFromRawEvent = (rawEvent: RawEvent): NDKEvent => {
  const ndkEvent = new NDKEvent()
  ndkEvent.ndk = ndk()
  ndkEvent.kind = rawEvent.kind
  ndkEvent.id = rawEvent.id
  ndkEvent.content = rawEvent.content
  ndkEvent.tags = rawEvent.tags
  ndkEvent.created_at = rawEvent.created_at
  ndkEvent.sig = rawEvent.sig
  ndkEvent.pubkey = rawEvent.pubkey
  return ndkEvent
}
export const getCachedName = (pubKey: string): string => {
  const profile = profileCache.get(pubKey)

  let name = ""
  if (profile) {
    if (profile.name) {
      name = profile.name
    } else if (!profile.name && profile.displayName) {
      name = profile.displayName
    } else if (
      !profile.name &&
      !profile.displayName &&
      profile.display_name &&
      typeof profile.display_name === "string" // can be number for some reason
    ) {
      name = profile.display_name
    }
  }

  return name || AnimalName(pubKey)
}

export const getQuotedEvent = (event: NDKEvent): string | false => {
  const qTag = event.tagValue("q")
  if (event.kind === KIND_TEXT_NOTE && qTag) return qTag
  const mentionTag = event.tags
    .filter((tag) => tag[0] === "e")
    .find((tag) => tag[3] === "mention" && tag[1] === event.id)
  if (mentionTag) return mentionTag[1]
  const match = event.content.match(eventRegex)
  if (match) return match[1]
  return false
}
