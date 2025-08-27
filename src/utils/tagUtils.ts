import {NDKTag} from "@nostr-dev-kit/ndk"

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
