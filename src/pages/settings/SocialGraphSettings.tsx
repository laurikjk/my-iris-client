import socialGraph, {
  getFollowLists,
  loadFromFile,
  saveToFile,
  loadAndMerge,
  downloadLargeGraph,
} from "@/utils/socialGraph"
import {UserRow} from "@/shared/components/user/UserRow"
import {useIsMobile} from "@/shared/hooks/useIsMobile"
import {useState, useEffect} from "react"

const TOP_USERS_LIMIT = 20

function SocialGraphSettings() {
  const [socialGraphSize, setSocialGraphSize] = useState(socialGraph().size())
  const [topFollowedUsers, setTopFollowedUsers] = useState<
    Array<{user: string; count: number}>
  >([])
  const [topMutedUsers, setTopMutedUsers] = useState<
    Array<{user: string; count: number}>
  >([])
  const isMobile = useIsMobile()
  const [maxSizeMB, setMaxSizeMB] = useState<number>(isMobile ? 10 : 50)

  useEffect(() => {
    const interval = setInterval(() => {
      setSocialGraphSize(socialGraph().size())
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const getTopNMostFollowedUsers = (n: number) => {
    const userFollowerCounts: Array<{user: string; count: number}> = []

    for (const user of socialGraph()) {
      const followers = socialGraph().getFollowersByUser(user)
      userFollowerCounts.push({user, count: followers.size})
    }

    userFollowerCounts.sort((a, b) => b.count - a.count)

    return userFollowerCounts.slice(0, n)
  }

  const getTopNMostMutedUsers = (n: number) => {
    const userMuteCounts: Array<{user: string; count: number}> = []

    for (const user of socialGraph()) {
      const mutedBy = socialGraph().getUserMutedBy(user)
      userMuteCounts.push({user, count: mutedBy.size})
    }

    userMuteCounts.sort((a, b) => b.count - a.count)

    return userMuteCounts.slice(0, n)
  }

  const handleFindTopNMostFollowedUsers = () => {
    setTopFollowedUsers(getTopNMostFollowedUsers(TOP_USERS_LIMIT))
  }

  const handleFindTopNMostMutedUsers = () => {
    setTopMutedUsers(getTopNMostMutedUsers(TOP_USERS_LIMIT))
  }

  const handleRecalculateFollowDistances = () => {
    socialGraph().recalculateFollowDistances()
    const removed = socialGraph().removeMutedNotFollowedUsers()
    console.log("Removed", removed, "muted not followed users")
    setSocialGraphSize(socialGraph().size())
  }

  const handleDownloadGraph = async () => {
    const maxBytes = maxSizeMB * 1024 * 1024 // Convert MB to bytes
    downloadLargeGraph(maxBytes)
  }

  return (
    <div className="prose">
      <h1 className="text-2xl mb-4">Social graph</h1>
      <div className="space-y-4">
        <div>
          <b>Users</b>: {socialGraphSize.users}
        </div>
        <div>
          <b>Follow relationships</b>: {socialGraphSize.follows}
        </div>
        <div>
          <b>Mutes</b>: {socialGraphSize.mutes}
        </div>
        <div>
          <b>Users by follow distance</b>:
        </div>
        <div className="space-y-1">
          {Object.entries(socialGraphSize.sizeByDistance).map(([distance, size]) => (
            <div key={distance}>
              <b>{distance}</b>: {size}
            </div>
          ))}
        </div>
        <div className="flex flex-row gap-4">
          <button className="btn btn-neutral btn-sm" onClick={() => saveToFile()}>
            Save to file
          </button>
          <button className="btn btn-neutral btn-sm" onClick={() => loadFromFile()}>
            Load from file
          </button>
          <button className="btn btn-neutral btn-sm" onClick={() => loadAndMerge()}>
            Load & merge
          </button>
        </div>
        <button
          onClick={handleRecalculateFollowDistances}
          className="btn btn-neutral btn-sm"
        >
          Recalculate Follow Distances (fast, no bandwith usage)
        </button>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="1000"
            value={maxSizeMB}
            onChange={(e) => setMaxSizeMB(Number(e.target.value))}
            className="input input-sm input-bordered w-24"
          />
          <span className="text-sm">MB</span>
          <button className="btn btn-neutral btn-sm" onClick={handleDownloadGraph}>
            Download graph up to {maxSizeMB}MB (binary)
          </button>
        </div>
        <button
          onClick={() => getFollowLists(socialGraph().getRoot(), false, 2)}
          className="btn btn-neutral btn-sm"
        >
          Recrawl follow lists (slow, bandwidth intensive)
        </button>
      </div>

      <div className="mt-4">
        <h3 className="mb-4">Top {TOP_USERS_LIMIT} Most Followed Users</h3>
        <button
          className="btn btn-neutral btn-sm mb-2"
          onClick={handleFindTopNMostFollowedUsers}
        >
          Find Top {TOP_USERS_LIMIT} Most Followed Users
        </button>
        {topFollowedUsers.map(({user, count}) => (
          <div key={user} className="flex items-center mb-2">
            <UserRow pubKey={user} />
            <span className="ml-2">{count}</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="mb-4">Top {TOP_USERS_LIMIT} Most Muted Users</h3>
        <button
          className="btn btn-neutral btn-sm mb-2"
          onClick={handleFindTopNMostMutedUsers}
        >
          Find Top {TOP_USERS_LIMIT} Most Muted Users
        </button>
        {topMutedUsers.map(({user, count}) => (
          <div key={user} className="flex items-center mb-2">
            <UserRow pubKey={user} />
            <span className="ml-2">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SocialGraphSettings
