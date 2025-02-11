import {Hexpubkey, NDKEvent} from "@nostr-dev-kit/ndk"
import socialGraph from "@/utils/socialGraph"
import {NostrEvent} from "nostr-social-graph"
import {ndk} from "irisdb-nostr"

export const muteUser = async (pubkey: string): Promise<string[]> => {
  // Check if pubkey already exists in the list before adding
  const myKey = socialGraph().getRoot()
  const mutedList = socialGraph().getMutedByUser(myKey)
  const newList = mutedList.has(pubkey) ? [...mutedList] : [...mutedList, pubkey]
  const newTags = newList.map((entry: string) => ["p", entry])

  const muteEvent = new NDKEvent(ndk())
  muteEvent.kind = 10000
  muteEvent.tags = newTags

  console.log("created mute event", muteEvent)

  socialGraph().handleEvent(muteEvent as NostrEvent)

  muteEvent.publish().catch((error) => {
    console.warn("Unable to mute user", error)
    return Array.from(mutedList)
  })

  return newList
}

export const unmuteUser = async (pubkey: string): Promise<string[]> => {
  const myKey = socialGraph().getRoot()
  const mutedList = socialGraph().getMutedByUser(myKey)
  const newList = Array.from(mutedList).filter((entry: string) => entry !== pubkey)
  const newTags = newList.map((entry: string) => ["p", entry])

  const unmuteEvent = new NDKEvent(ndk())
  unmuteEvent.kind = 10000
  unmuteEvent.tags = newTags

  socialGraph().handleEvent(unmuteEvent as NostrEvent)

  unmuteEvent.publish().catch((error) => {
    console.warn("Unable to unmute user", error)
    return Array.from(mutedList)
  })

  return newList
}

export const submitReport = async (
  reason: string,
  content: string,
  pubkey: Hexpubkey, //pubkey needed
  id?: string //event optional
) => {
  const reportEvent = new NDKEvent(ndk())
  reportEvent.kind = 1984
  reportEvent.content = content

  reportEvent.tags = id
    ? [
        ["e", id, reason],
        ["p", pubkey],
      ]
    : [["p", pubkey, reason]]
  try {
    reportEvent.publish().catch((error) => {
      console.warn("Unable to send report", error)
      return Promise.reject(error)
    })
  } catch (error) {
    console.warn("Unable to send report", error)
    return Promise.reject(error)
  }
}
