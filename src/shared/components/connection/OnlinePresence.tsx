import {useEffect, useState, useMemo} from "react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {UserRow} from "@/shared/components/user/UserRow"
import {getMutualFollows} from "@/utils/socialGraph"
import {useUserStore} from "@/stores/user"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {shouldHideUser} from "@/utils/visibility"

type OnlineUser = {
  pubkey: string
  lastSeen: number
}

export function OnlinePresence() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [displayCount, setDisplayCount] = useState(20)
  const myPubkey = useUserStore((state) => state.publicKey)

  useEffect(() => {
    const updateOnlineUsers = () => {
      setOnlineUsers(peerConnectionManager.getOnlineUsers())
    }

    updateOnlineUsers()
    peerConnectionManager.on("update", updateOnlineUsers)

    return () => {
      peerConnectionManager.off("update", updateOnlineUsers)
    }
  }, [])

  // Get all mutual follows and sort online ones first
  const sortedMutualFollows = useMemo(() => {
    if (!myPubkey) return []

    const mutualFollows = getMutualFollows(myPubkey)
    const visibleMutualFollows = mutualFollows.filter((pubkey) => !shouldHideUser(pubkey))

    const onlineSet = new Set(onlineUsers.map((u) => u.pubkey))

    // Sort: online first, then by pubkey
    return visibleMutualFollows.sort((a, b) => {
      const aOnline = onlineSet.has(a)
      const bOnline = onlineSet.has(b)

      if (aOnline && !bOnline) return -1
      if (!aOnline && bOnline) return 1
      return a.localeCompare(b)
    })
  }, [myPubkey, onlineUsers])

  const loadMore = () => {
    if (displayCount < sortedMutualFollows.length) {
      setDisplayCount((prev) => Math.min(prev + 20, sortedMutualFollows.length))
    }
  }

  if (sortedMutualFollows.length === 0) {
    return (
      <div className="text-sm text-base-content/50 text-center py-4">
        No mutual follows
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 max-h-96 overflow-y-auto" data-scrollable>
      <InfiniteScroll onLoadMore={loadMore}>
        {sortedMutualFollows.slice(0, displayCount).map((pubkey) => (
          <UserRow key={pubkey} pubKey={pubkey} />
        ))}
      </InfiniteScroll>
    </div>
  )
}
