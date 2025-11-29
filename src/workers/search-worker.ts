import Fuse from "fuse.js"

export type SearchResult = {
  name: string
  pubKey: string
  nip05?: string
}

type WorkerMessage =
  | {type: "init"; profiles: SearchResult[]}
  | {type: "add"; profile: SearchResult}
  | {type: "remove"; pubKey: string}
  | {type: "search"; query: string; requestId: number}
  | {type: "update"; pubKey: string; profile: SearchResult}

type WorkerResponse =
  | {type: "ready"}
  | {
      type: "searchResult"
      requestId: number
      results: Array<{item: SearchResult; score?: number}>
    }

let searchIndex: Fuse<SearchResult> = new Fuse<SearchResult>([], {
  keys: ["name", "nip05"],
  includeScore: true,
})

const indexedPubkeys = new Set<string>()

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data

  switch (msg.type) {
    case "init": {
      const profiles = msg.profiles.filter((p) => p.name)
      searchIndex = new Fuse<SearchResult>(profiles, {
        keys: ["name", "nip05"],
        includeScore: true,
      })
      indexedPubkeys.clear()
      for (const profile of profiles) {
        indexedPubkeys.add(profile.pubKey)
      }
      postMessage({type: "ready"} satisfies WorkerResponse)
      break
    }

    case "add": {
      if (msg.profile.name && !indexedPubkeys.has(msg.profile.pubKey)) {
        searchIndex.add(msg.profile)
        indexedPubkeys.add(msg.profile.pubKey)
      }
      break
    }

    case "remove": {
      searchIndex.remove((profile) => profile.pubKey === msg.pubKey)
      indexedPubkeys.delete(msg.pubKey)
      break
    }

    case "update": {
      searchIndex.remove((profile) => profile.pubKey === msg.pubKey)
      if (msg.profile.name) {
        searchIndex.add(msg.profile)
        indexedPubkeys.add(msg.pubKey)
      }
      break
    }

    case "search": {
      const results = searchIndex.search(msg.query)
      postMessage({
        type: "searchResult",
        requestId: msg.requestId,
        results: results.map((r) => ({item: r.item, score: r.score})),
      } satisfies WorkerResponse)
      break
    }
  }
}
