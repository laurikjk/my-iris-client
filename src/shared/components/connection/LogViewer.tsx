import {ReactNode} from "react"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {RiArrowDownSLine, RiArrowRightSLine} from "@remixicon/react"

export interface LogViewerEntry {
  timestamp: number
  level: string
  message: string
}

interface LogViewerProps<T extends LogViewerEntry> {
  title: string
  logs: T[]
  isExpanded: boolean
  onToggleExpanded: () => void
  onClear: () => void
  onCopyAll: () => void
  filterText?: string
  onFilterChange?: (text: string) => void
  renderLogItem: (log: T, index: number) => ReactNode
}

export function LogViewer<T extends LogViewerEntry>({
  title,
  logs,
  isExpanded,
  onToggleExpanded,
  onClear,
  onCopyAll,
  filterText,
  onFilterChange,
  renderLogItem,
}: LogViewerProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-1 text-sm font-semibold hover:opacity-70 transition-opacity"
        >
          {isExpanded ? (
            <RiArrowDownSLine className="w-5 h-5" />
          ) : (
            <RiArrowRightSLine className="w-5 h-5" />
          )}
          <span>
            {title} ({logs.length})
          </span>
        </button>
        {isExpanded && (
          <div className="flex gap-2">
            <button onClick={onCopyAll} className="btn btn-xs btn-ghost">
              Copy All
            </button>
            <button onClick={onClear} className="btn btn-xs btn-ghost">
              Clear
            </button>
          </div>
        )}
      </div>

      {isExpanded && onFilterChange && (
        <input
          type="text"
          placeholder="Filter logs..."
          value={filterText || ""}
          onChange={(e) => onFilterChange(e.target.value)}
          className="input input-sm input-bordered w-full"
        />
      )}

      {isExpanded && (
        <div className="bg-base-300 rounded-lg p-3 max-h-96 overflow-y-auto font-mono text-xs space-y-1 select-text">
          {logs.length === 0 ? (
            <div className="text-base-content/50 text-center py-4">No logs yet</div>
          ) : (
            logs.map((log, i) => renderLogItem(log, i))
          )}
        </div>
      )}
    </div>
  )
}

interface LogItemProps {
  timestamp: number
  level: string
  badges: ReactNode[]
  message: string
}

export function LogItem({timestamp, level, badges, message}: LogItemProps) {
  const getLevelColor = () => {
    switch (level) {
      case "error":
        return "text-error"
      case "warn":
        return "text-warning"
      default:
        return "text-base-content"
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 items-baseline ${getLevelColor()}`}>
      <span className="text-base-content/50 shrink-0 w-16 text-right">
        <RelativeTime from={timestamp} />
      </span>
      {badges}
      <span className="break-all flex-1 min-w-0">{message}</span>
    </div>
  )
}
