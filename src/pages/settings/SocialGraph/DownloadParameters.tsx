import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {formatSize} from "@/shared/utils/formatSize"

interface DownloadParametersProps {
  maxNodes: number
  setMaxNodes: (value: number) => void
  maxEdges: number | undefined
  setMaxEdges: (value: number | undefined) => void
  maxDistance: number | undefined
  setMaxDistance: (value: number | undefined) => void
  maxEdgesPerNode: number | undefined
  setMaxEdgesPerNode: (value: number | undefined) => void
  format: string
  setFormat: (value: string) => void
  isDownloading: boolean
  downloadedBytes: number | null
  downloadError: string | null
  onDownload: () => void
}

export function DownloadParameters({
  maxNodes,
  setMaxNodes,
  maxEdges,
  setMaxEdges,
  maxDistance,
  setMaxDistance,
  maxEdgesPerNode,
  setMaxEdgesPerNode,
  format,
  setFormat,
  isDownloading,
  downloadedBytes,
  downloadError,
  onDownload,
}: DownloadParametersProps) {
  return (
    <SettingsGroup title="Download Snapshot">
      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Max nodes</span>
          <input
            type="number"
            min="1"
            value={maxNodes}
            onChange={(e) => setMaxNodes(Number(e.target.value))}
            className="bg-transparent border-none p-0 text-base focus:outline-none text-right w-20"
          />
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Max edges</span>
          <input
            type="number"
            min="1"
            value={maxEdges ?? ""}
            onChange={(e) =>
              setMaxEdges(e.target.value ? Number(e.target.value) : undefined)
            }
            className="bg-transparent border-none p-0 text-base focus:outline-none text-right w-20"
            placeholder="All"
          />
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Max distance</span>
          <input
            type="number"
            min="1"
            value={maxDistance ?? ""}
            onChange={(e) =>
              setMaxDistance(e.target.value ? Number(e.target.value) : undefined)
            }
            className="bg-transparent border-none p-0 text-base focus:outline-none text-right w-20"
            placeholder="All"
          />
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Max edges per node</span>
          <input
            type="number"
            min="1"
            value={maxEdgesPerNode ?? ""}
            onChange={(e) =>
              setMaxEdgesPerNode(e.target.value ? Number(e.target.value) : undefined)
            }
            className="bg-transparent border-none p-0 text-base focus:outline-none text-right w-20"
            placeholder="All"
          />
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="select select-sm bg-base-200 border-base-content/20"
          >
            <option value="binary">Binary</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem isLast>
        <div className="flex flex-col space-y-1">
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="text-info text-left"
          >
            {isDownloading ? "Downloading..." : "Download graph"}
          </button>
          <span className="text-xs text-base-content/60">
            Download from{" "}
            <a
              href="https://graph-api.iris.to"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              graph-api.iris.to
            </a>
          </span>
          {downloadedBytes !== null && !isDownloading && !downloadError && (
            <span className="text-xs text-success">
              Downloaded: {formatSize(downloadedBytes)}
            </span>
          )}
          {downloadError && (
            <span className="text-xs text-error">Error: {downloadError}</span>
          )}
          {isDownloading && (
            <span className="text-xs text-info">
              {downloadedBytes && downloadedBytes >= 1024
                ? `Downloading... ${formatSize(downloadedBytes)}`
                : "Starting download..."}
            </span>
          )}
        </div>
      </SettingsGroupItem>
    </SettingsGroup>
  )
}
