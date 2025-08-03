import {Hexpubkey, NDKEvent} from "@nostr-dev-kit/ndk"
import socialGraph from "@/utils/socialGraph"
import {NostrEvent} from "nostr-social-graph"
import {ndk} from "@/utils/ndk"
import {KIND_MUTE_LIST, KIND_REPORT} from "@/utils/constants"
import {clearVisibilityCache} from "@/utils/visibility"

export const muteUser = async (pubkey: string): Promise<string[]> => {
  const {mutedList} = validateInputAndGetMutedList(pubkey)

  // Check if pubkey already exists in the list before adding
  const newList = mutedList.has(pubkey) ? [...mutedList] : [...mutedList, pubkey]

  // Filter out any empty or invalid entries
  const validEntries = filterValidEntries(newList)
  return await updateMuteList(validEntries, mutedList)
}

export const unmuteUser = async (pubkey: string): Promise<string[]> => {
  const {mutedList} = validateInputAndGetMutedList(pubkey)

  const newList = Array.from(mutedList).filter(
    (entry: string) => entry !== pubkey && entry && entry.trim() !== ""
  )

  // Filter out any empty or invalid entries
  const validEntries = filterValidEntries(newList)
  return await updateMuteList(validEntries, mutedList)
}

const validateInputAndGetMutedList = (pubkey: string) => {
  // Validate input
  if (!pubkey || typeof pubkey !== "string" || pubkey.trim() === "") {
    throw new Error("Invalid pubkey: cannot be empty or whitespace")
  }

  const myKey = socialGraph().getRoot()
  if (!myKey || typeof myKey !== "string" || myKey.trim() === "") {
    throw new Error("Invalid user key: user not properly initialized")
  }

  const mutedList = socialGraph().getMutedByUser(myKey)
  return {mutedList, myKey}
}

const filterValidEntries = (entries: string[]): string[] => {
  return entries.filter(
    (entry) => entry && typeof entry === "string" && entry.trim() !== ""
  )
}

const updateMuteList = async (
  validEntries: string[],
  originalMutedList: Set<string>
): Promise<string[]> => {
  const newTags = validEntries.map((entry: string) => ["p", entry.trim()])

  const muteEvent = new NDKEvent(ndk())
  muteEvent.kind = KIND_MUTE_LIST
  muteEvent.tags = newTags

  await muteEvent.sign()

  socialGraph().handleEvent(muteEvent as NostrEvent)

  // Clear visibility cache so muted/unmuted users are immediately updated
  clearVisibilityCache()

  muteEvent.publish().catch((error) => {
    console.warn("Unable to update mute list", error)
    return Array.from(originalMutedList)
  })

  return validEntries
}

export const submitReport = async (
  reason: string,
  content: string,
  pubkey: Hexpubkey, //pubkey needed
  id?: string //event optional
) => {
  const reportEvent = new NDKEvent(ndk())
  reportEvent.kind = KIND_REPORT
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
