import {
  usePublicState as usePublicStateOriginal,
  useAuthors as originalUseAuthors,
} from "irisdb-hooks"
import {NostrSubscribe, PublicKey, publicState as originalPublicState} from "irisdb-nostr"
import {NDKEventFromRawEvent, RawEvent} from "@/utils/nostr"
import {NostrEvent} from "nostr-social-graph"
import {JsonValue} from "irisdb"
import {ndk} from "@/utils/ndk"

const publish = (event: Partial<NostrEvent>) =>
  NDKEventFromRawEvent(event as RawEvent).publish()

const subscribe: NostrSubscribe = (filter, onEvent) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    onEvent(event as unknown as RawEvent)
  })
  return () => sub.stop()
}

export function useAuthors(ownerOrGroup?: string, groupPath?: string) {
  return originalUseAuthors(publish, subscribe, ownerOrGroup, groupPath)
}

export function publicState(authors: string | Array<string | PublicKey>) {
  return originalPublicState(publish, subscribe, authors)
}

export default function usePublicState<T = JsonValue>(
  authors: string[],
  path: string,
  initialValue: T,
  typeGuard?: (value: JsonValue) => T,
  recursion?: number
) {
  return usePublicStateOriginal<T>(
    publish,
    subscribe,
    authors,
    path,
    initialValue,
    typeGuard,
    recursion
  )
}
