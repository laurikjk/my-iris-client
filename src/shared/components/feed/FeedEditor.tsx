import {useEffect, useState, ChangeEvent, KeyboardEvent} from "react"
import {RiDeleteBinLine, RiFileCopyLine, RiMapPinLine} from "@remixicon/react"
import {type FeedConfig} from "@/stores/feed"
import MultiRelaySelector from "@/shared/components/ui/MultiRelaySelector"
import EventKindsSelector from "@/shared/components/ui/EventKindsSelector"
import {getCurrentLocationGeohash} from "@/utils/geohash"

interface FeedEditorProps {
  feedConfig: FeedConfig
  onConfigChange: (config: FeedConfig) => void
  onClose: () => void
  onDelete?: () => void
  onReset?: () => void
  onClone?: () => void
  showDeleteButton?: boolean
  showResetButton?: boolean
  showCloneButton?: boolean
}

function FeedEditor({
  feedConfig,
  onConfigChange,
  onClose,
  onDelete,
  onReset,
  onClone,
  showDeleteButton = true,
  showResetButton = true,
  showCloneButton = true,
}: FeedEditorProps) {
  const [editingName, setEditingName] = useState(feedConfig.customName || feedConfig.name)
  const [localConfig, setLocalConfig] = useState<FeedConfig>(feedConfig)

  // Helper function for common checkboxes
  const renderCommonCheckboxes = (
    updateConfig: (field: keyof FeedConfig, value: unknown) => void
  ) => {
    const showReplies = !(localConfig?.hideReplies ?? false)

    return (
      <>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showReplies}
            onChange={(e) => {
              updateConfig("hideReplies", !e.target.checked)
              // If hiding replies, also hide replied-to posts
              if (!e.target.checked) {
                updateConfig("showRepliedTo", false)
              }
            }}
            className="checkbox checkbox-sm"
          />
          <span className="text-sm text-base-content/70">Show replies</span>
        </label>

        <label
          className={`flex items-center gap-2 cursor-pointer ml-6 ${
            !showReplies ? "opacity-50" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={showReplies && (localConfig?.showRepliedTo ?? true)}
            onChange={(e) => updateConfig("showRepliedTo", e.target.checked)}
            className="checkbox checkbox-sm"
            disabled={!showReplies}
          />
          <span className="text-sm text-base-content/70">Show replied-to posts</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={localConfig?.requiresMedia ?? false}
            onChange={(e) => updateConfig("requiresMedia", e.target.checked)}
            className="checkbox checkbox-sm"
          />
          <span className="text-sm text-base-content/70">Only show posts with media</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={localConfig?.excludeSeen ?? false}
            onChange={(e) => updateConfig("excludeSeen", e.target.checked)}
            className="checkbox checkbox-sm"
          />
          <span className="text-sm text-base-content/70">Hide seen posts</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={localConfig?.autoShowNewEvents ?? false}
            onChange={(e) => updateConfig("autoShowNewEvents", e.target.checked)}
            className="checkbox checkbox-sm"
          />
          <span className="text-sm text-base-content/70">
            Show new events automatically
          </span>
        </label>
      </>
    )
  }

  // Update local config when feedConfig prop changes
  useEffect(() => {
    setLocalConfig(feedConfig)
    setEditingName(feedConfig.customName || feedConfig.name)
  }, [feedConfig])

  // Notify parent of config changes
  useEffect(() => {
    if (JSON.stringify(localConfig) !== JSON.stringify(feedConfig)) {
      const timer = setTimeout(() => {
        onConfigChange(localConfig)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [localConfig, feedConfig, onConfigChange])

  // Update local config immediately
  const updateLocalConfig = (field: keyof FeedConfig, value: unknown) => {
    setLocalConfig((prev) => {
      if (!prev) return prev
      return {...prev, [field]: value}
    })
  }

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setEditingName(newName)
    // Update local config instead of directly saving to store
    updateLocalConfig("customName", newName.trim() || undefined)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditingName(feedConfig.customName || feedConfig.name)
    }
  }

  const updateConfig = updateLocalConfig

  return (
    <div className="flex flex-col gap-4 mt-4 p-4 border border-base-300 rounded-lg">
      <div className="flex justify-between items-center">
        <div className="text-lg font-semibold">
          Edit &quot;{localConfig.customName || localConfig.name}&quot;
        </div>
        {showCloneButton && onClone && (
          <button
            onClick={onClone}
            className="btn btn-sm btn-neutral"
            title="Clone this feed"
          >
            <RiFileCopyLine className="w-4 h-4" />
            Clone
          </button>
        )}
      </div>

      {/* Basic Settings */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem]">Name</span>
        <input
          type="text"
          value={editingName}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          className="input input-sm flex-1 text-sm"
          placeholder={localConfig.name}
        />
      </div>

      {/* Follow Distance */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">
          Follow Distance
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={localConfig.followDistance !== undefined}
              onChange={(e) => {
                if (e.target.checked) {
                  // Enable with default value of 3
                  updateConfig("followDistance", 3)
                } else {
                  // Disable by setting to undefined
                  updateConfig("followDistance", undefined)
                }
              }}
              className="checkbox checkbox-sm"
            />
            <input
              type="number"
              min="0"
              max="10"
              value={localConfig.followDistance ?? ""}
              onChange={(e) =>
                updateConfig(
                  "followDistance",
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
              className="input input-sm w-20 text-sm"
              disabled={localConfig.followDistance === undefined}
            />
          </div>
          <span className="text-xs text-base-content/50 mt-1 block">
            Max degrees of separation (0=only yourself, 1=follows only, 2=friends of
            friends, etc.)
          </span>
        </div>
      </div>

      {/* Filter Kinds */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">
          Event Kinds
        </span>
        <div className="flex-1 overflow-hidden">
          <EventKindsSelector
            selectedKinds={localConfig.filter?.kinds || []}
            onKindsChange={(kinds) => {
              const currentFilter = localConfig.filter || {}
              if (kinds.length === 0) {
                // Remove kinds property if no kinds selected
                const filterWithoutKinds = Object.fromEntries(
                  Object.entries(currentFilter).filter(([key]) => key !== "kinds")
                )
                updateConfig(
                  "filter",
                  Object.keys(filterWithoutKinds).length > 0
                    ? filterWithoutKinds
                    : undefined
                )
              } else {
                updateConfig("filter", {...currentFilter, kinds})
              }
            }}
          />
          <span className="text-xs text-base-content/50 mt-1 block">
            Select event types to include in this feed. Select none to display all.
          </span>
        </div>
      </div>

      {/* Search Term */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">Search</span>
        <div className="flex-1">
          <input
            type="text"
            value={localConfig.filter?.search || ""}
            onChange={(e) => {
              const inputValue = e.target.value.trim()
              const currentFilter = localConfig.filter || {}
              if (inputValue === "") {
                // Remove search property if input is empty
                const filterWithoutSearch = Object.fromEntries(
                  Object.entries(currentFilter).filter(([key]) => key !== "search")
                )
                updateConfig(
                  "filter",
                  Object.keys(filterWithoutSearch).length > 0
                    ? filterWithoutSearch
                    : undefined
                )
              } else {
                updateConfig("filter", {...currentFilter, search: inputValue})
              }
            }}
            className="input input-sm w-full text-sm"
            placeholder="Search terms"
          />
          <span className="text-xs text-base-content/50 mt-1 block">
            Text to search for in posts
          </span>
        </div>
      </div>

      {/* Limit */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">Limit</span>
        <div className="flex-1">
          <input
            type="number"
            min="10"
            max="1000"
            value={localConfig.filter?.limit || ""}
            onChange={(e) =>
              updateConfig("filter", {
                ...(localConfig.filter || {}),
                limit: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            className="input input-sm w-24 text-sm"
            placeholder="100"
          />
          <span className="text-xs text-base-content/50 mt-1 block">
            Max events to initially fetch
          </span>
        </div>
      </div>

      {/* Relay Selection */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">Relays</span>
        <div className="flex-1">
          <MultiRelaySelector
            selectedRelays={localConfig.relayUrls || []}
            onRelaysChange={(relays) => {
              updateConfig("relayUrls", relays.length > 0 ? relays : undefined)
            }}
            placeholder="Default relays"
          />
          <span className="text-xs text-base-content/50 mt-1 block">
            Leave empty to use default relays
          </span>
        </div>
      </div>

      {/* Geohash Filter */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">Geohash</span>
        <div className="flex-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={(localConfig.filter?.["#g"] || []).join(", ")}
              onChange={(e) => {
                const inputValue = e.target.value.trim()
                const currentFilter = localConfig.filter || {}
                if (inputValue === "") {
                  // Remove #g property if input is empty
                  const filterWithoutGeohash = Object.fromEntries(
                    Object.entries(currentFilter).filter(([key]) => key !== "#g")
                  )
                  updateConfig(
                    "filter",
                    Object.keys(filterWithoutGeohash).length > 0
                      ? filterWithoutGeohash
                      : undefined
                  )
                } else {
                  // Split by comma and trim each value
                  const geohashes = inputValue
                    .split(",")
                    .map((g) => g.trim())
                    .filter((g) => g.length > 0)
                  updateConfig("filter", {...currentFilter, "#g": geohashes})
                }
              }}
              className="input input-sm flex-1 text-sm"
              placeholder="e.g. u2mwdd, u2mw (comma-separated)"
            />
            <button
              onClick={async () => {
                const geohash = await getCurrentLocationGeohash(4) // Get 4-char precision (~40km)
                if (geohash) {
                  const currentFilter = localConfig.filter || {}
                  const currentGeohashes = currentFilter["#g"] || []

                  // Add multiple precision levels for privacy and broader matching
                  // 3 chars = ~150km, 4 chars = ~40km
                  const precisions = [
                    geohash.substring(0, 3), // City/region level
                    geohash.substring(0, 4), // District level
                  ]

                  // Only add geohashes that aren't already present
                  const newGeohashes = precisions.filter(
                    (gh) => !currentGeohashes.includes(gh)
                  )

                  if (newGeohashes.length > 0) {
                    updateConfig("filter", {
                      ...currentFilter,
                      "#g": [...currentGeohashes, ...newGeohashes],
                    })
                  }
                }
              }}
              className="btn btn-sm btn-neutral"
              title="Add current location (multiple precision levels)"
            >
              <RiMapPinLine className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs text-base-content/50 mt-1 block">
            Filter posts by{" "}
            <a
              href="https://en.wikipedia.org/wiki/Geohash"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-base-content/80"
            >
              geohash
            </a>{" "}
            location tags. Shorter = broader area (3 chars ≈ city, 4 chars ≈ district).
          </span>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-col gap-2">{renderCommonCheckboxes(updateConfig)}</div>

      {/* Action Buttons */}
      <div className="flex justify-between gap-2 pt-2 border-t border-base-300">
        <button onClick={onClose} className="btn btn-sm btn-primary" title="Done editing">
          Done
        </button>
        <div className="flex flex-row gap-2">
          {showResetButton && onReset && (
            <button
              onClick={onReset}
              className="btn btn-sm btn-neutral"
              title="Reset feed"
            >
              Reset
            </button>
          )}
          {showDeleteButton && onDelete && (
            <button
              onClick={onDelete}
              className="btn btn-sm btn-neutral"
              title="Delete feed"
            >
              <RiDeleteBinLine className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FeedEditor
