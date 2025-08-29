import socialGraph, {
  clearGraph,
  resetGraph,
  downloadLargeGraph,
} from "@/utils/socialGraph"
import {useState, useEffect} from "react"
import {Statistics} from "./Statistics"
import {FileOperations} from "./FileOperations"
import {Maintenance} from "./Maintenance"
import {DownloadParameters} from "./DownloadParameters"
import {TopUsers} from "./TopUsers"

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
  const [isCrawling, setIsCrawling] = useState<boolean>(false)

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

  const handleClearGraph = async () => {
    if (
      confirm(
        "Are you sure you want to clear the entire social graph? This cannot be undone."
      )
    ) {
      await clearGraph()
      setSocialGraphSize(socialGraph().size())
    }
  }

  const handleResetGraph = async () => {
    if (
      confirm(
        "Are you sure you want to reset the social graph to default? This will replace your current graph."
      )
    ) {
      await resetGraph()
      setSocialGraphSize(socialGraph().size())
    }
  }

  const handleDownloadGraph = async () => {
    setDownloadedBytes(null)
    setIsDownloading(true)
    setDownloadError(null)

    if (downloadTimeout) {
      clearTimeout(downloadTimeout)
    }

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

            if (downloadTimeout) {
              clearTimeout(downloadTimeout)
            }

            const timeout = setTimeout(() => {
              setIsDownloading(false)
              setDownloadTimeout(null)
            }, 2000)

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
    }, 10)
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <Statistics socialGraphSize={socialGraphSize} />

          <Maintenance
            isCrawling={isCrawling}
            setIsCrawling={setIsCrawling}
            onRecalculateDistances={handleRecalculateFollowDistances}
          />

          <FileOperations
            onClearGraph={handleClearGraph}
            onResetGraph={handleResetGraph}
          />

          <DownloadParameters
            maxNodes={maxNodes}
            setMaxNodes={setMaxNodes}
            maxEdges={maxEdges}
            setMaxEdges={setMaxEdges}
            maxDistance={maxDistance}
            setMaxDistance={setMaxDistance}
            maxEdgesPerNode={maxEdgesPerNode}
            setMaxEdgesPerNode={setMaxEdgesPerNode}
            format={format}
            setFormat={setFormat}
            isDownloading={isDownloading}
            downloadedBytes={downloadedBytes}
            downloadError={downloadError}
            onDownload={handleDownloadGraph}
          />

          <TopUsers
            topFollowedUsers={topFollowedUsers}
            topMutedUsers={topMutedUsers}
            topUsersLimit={TOP_USERS_LIMIT}
            onFindTopFollowed={handleFindTopNMostFollowedUsers}
            onFindTopMuted={handleFindTopNMostMutedUsers}
          />
        </div>
      </div>
    </div>
  )
}

export default SocialGraphSettings
