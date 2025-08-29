import {downloadLargeGraph} from "@/utils/socialGraph"
import {useState} from "react"
import {Statistics} from "./Statistics"
import {FileOperations} from "./FileOperations"
import {Maintenance} from "./Maintenance"
import {DownloadParameters} from "./DownloadParameters"
import {TopUsers} from "./TopUsers"

function SocialGraphSettings() {
  const [maxNodes, setMaxNodes] = useState<number>(50000)
  const [maxEdges, setMaxEdges] = useState<number | undefined>(undefined)
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined)
  const [maxEdgesPerNode, setMaxEdgesPerNode] = useState<number | undefined>(undefined)
  const [format, setFormat] = useState<string>("binary")
  const [downloadedBytes, setDownloadedBytes] = useState<number | null>(null)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadTimeout, setDownloadTimeout] = useState<NodeJS.Timeout | null>(null)

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
          <Statistics />

          <Maintenance />

          <FileOperations />

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

          <TopUsers />
        </div>
      </div>
    </div>
  )
}

export default SocialGraphSettings
