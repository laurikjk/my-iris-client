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
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadTimeout, setDownloadTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setSocialGraphSize(socialGraph().size())
    }, 2000)

    return () => clearInterval(interval)
  }, [socialGraph])

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
    setIsDownloading(true)
    setDownloadError(null)

    // Clear any existing timeout
    if (downloadTimeout) {
      clearTimeout(downloadTimeout)
    }

    // Small delay to ensure UI updates before potentially blocking operation
    setTimeout(async () => {
      try {
        await downloadLargeGraph({
          maxNodes,
          maxEdges,
          maxDistance,
          maxEdgesPerNode,
          format,
          onDownloaded: (bytes) => {
            setDownloadedBytes(bytes)

            // Clear existing timeout and set new one
            if (downloadTimeout) {
              clearTimeout(downloadTimeout)
            }

            // Set timeout to detect when download stops
            const timeout = setTimeout(() => {
              setIsDownloading(false)
              setDownloadTimeout(null)
            }, 2000) // 2 seconds of no updates = download complete

            setDownloadTimeout(timeout)
          },
        })
      } catch (error) {
        console.error("Download failed:", error)
        setDownloadError(error instanceof Error ? error.message : "Download failed")
        setIsDownloading(false)
        if (downloadTimeout) {
          clearTimeout(downloadTimeout)
          setDownloadTimeout(null)
        }
      }
      // Don't set isDownloading to false here - let the timeout handle it
    }, 10)
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
        <button
          onClick={() => getFollowLists(socialGraph().getRoot(), false, 2)}
          className="btn btn-neutral btn-sm"
        >
          Recrawl follow lists (slow, bandwidth intensive)
        </button>

        <div className="bg-base-200/50 border border-base-300 rounded-lg p-4 pt-0 mt-2">
          <h3 className="text-lg font-semibold mb-4 text-base-content">
            Download from{" "}
            <a href="https://graph-api.iris.to" target="_blank" rel="noopener noreferrer">
              graph-api.iris.to
            </a>
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">maxNodes</label>
                <input
                  type="number"
                  min="1"
                  value={maxNodes}
                  onChange={(e) => setMaxNodes(Number(e.target.value))}
                  className="input input-sm input-bordered"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">maxEdges</label>
                <input
                  type="number"
                  min="1"
                  value={maxEdges ?? ""}
                  onChange={(e) =>
                    setMaxEdges(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="input input-sm input-bordered"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">maxDistance</label>
                <input
                  type="number"
                  min="1"
                  value={maxDistance ?? ""}
                  onChange={(e) =>
                    setMaxDistance(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="input input-sm input-bordered"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">maxEdgesPerNode</label>
                <input
                  type="number"
                  min="1"
                  value={maxEdgesPerNode ?? ""}
                  onChange={(e) =>
                    setMaxEdgesPerNode(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="input input-sm input-bordered"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="input input-sm input-bordered"
                >
                  <option value="binary">binary</option>
                  <option value="json">json</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <button
                className="btn btn-neutral btn-sm"
                onClick={handleDownloadGraph}
                disabled={isDownloading}
              >
                {isDownloading ? <>Downloading...</> : "Download graph"}
              </button>
              {downloadedBytes !== null && !isDownloading && !downloadError && (
                <span className="text-sm text-success">
                  Downloaded: {formatSize(downloadedBytes)}
                </span>
              )}
              {downloadError && (
                <span className="text-sm text-error">Error: {downloadError}</span>
              )}
              {isDownloading && downloadedBytes === null && (
                <span className="text-sm text-info">Starting download...</span>
              )}
              {isDownloading && downloadedBytes !== null && downloadedBytes < 1024 && (
                <span className="text-sm text-info">Starting download...</span>
              )}
              {isDownloading && downloadedBytes !== null && downloadedBytes >= 1024 && (
                <span className="text-sm text-info">
                  Downloading... {formatSize(downloadedBytes)}
                </span>
              )}
            </div>
          </div>
        </div>
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
