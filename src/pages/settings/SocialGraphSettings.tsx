import socialGraph, {
  getFollowLists,
  loadFromFile,
  saveToFile,
  loadAndMerge,
  downloadLargeGraph,
} from "@/utils/socialGraph"
import {UserRow} from "@/shared/components/user/UserRow"
import {useState, useEffect} from "react"
import {formatSize} from "@/shared/utils/formatSize"

const TOP_USERS_LIMIT = 20

function SocialGraphSettings() {
  const [socialGraphSize, setSocialGraphSize] = useState(socialGraph().size())
  const [topFollowedUsers, setTopFollowedUsers] = useState<
    Array<{user: string; count: number}>
  >([])
  const [topMutedUsers, setTopMutedUsers] = useState<
    Array<{user: string; count: number}>
  >([])
  const [maxNodes, setMaxNodes] = useState<number>(50000)
  const [maxEdges, setMaxEdges] = useState<number | undefined>(undefined)
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined)
  const [maxEdgesPerNode, setMaxEdgesPerNode] = useState<number | undefined>(undefined)
  const [format, setFormat] = useState<string>("binary")
  const [downloadedBytes, setDownloadedBytes] = useState<number | null>(null)

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
    setDownloadedBytes(null)
    downloadLargeGraph({
      maxNodes,
      maxEdges,
      maxDistance,
      maxEdgesPerNode,
      format,
      onDownloaded: setDownloadedBytes,
    })
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm">maxNodes</label>
            <input
              type="number"
              min="1"
              value={maxNodes}
              onChange={(e) => setMaxNodes(Number(e.target.value))}
              className="input input-sm input-bordered w-24"
            />
            <label className="text-sm">maxEdges</label>
            <input
              type="number"
              min="1"
              value={maxEdges ?? ""}
              onChange={(e) =>
                setMaxEdges(e.target.value ? Number(e.target.value) : undefined)
              }
              className="input input-sm input-bordered w-24"
            />
            <label className="text-sm">maxDistance</label>
            <input
              type="number"
              min="1"
              value={maxDistance ?? ""}
              onChange={(e) =>
                setMaxDistance(e.target.value ? Number(e.target.value) : undefined)
              }
              className="input input-sm input-bordered w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">maxEdgesPerNode</label>
            <input
              type="number"
              min="1"
              value={maxEdgesPerNode ?? ""}
              onChange={(e) =>
                setMaxEdgesPerNode(e.target.value ? Number(e.target.value) : undefined)
              }
              className="input input-sm input-bordered w-24"
            />
            <label className="text-sm">format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="input input-sm input-bordered w-32"
            >
              <option value="binary">binary</option>
              <option value="json">json</option>
            </select>
            <button className="btn btn-neutral btn-sm" onClick={handleDownloadGraph}>
              Download graph
            </button>
            {downloadedBytes !== null && (
              <span className="text-sm">Downloaded: {formatSize(downloadedBytes)}</span>
            )}
          </div>
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
