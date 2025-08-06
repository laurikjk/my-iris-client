import {useEffect, useState, ChangeEvent, KeyboardEvent} from "react"
import {RiDeleteBinLine, RiFileCopyLine} from "@remixicon/react"
import {useFeedStore, type FeedConfig} from "@/stores/feed"
import RelaySelector from "@/shared/components/ui/RelaySelector"
import EventKindsSelector from "@/shared/components/ui/EventKindsSelector"

interface FeedEditorProps {
  activeTab: string
  tabs: FeedConfig[]
  onEditModeToggle: () => void
  onDeleteFeed: (feedId: string) => void
  onResetFeeds: () => void
  onCloneFeed: (feedId: string) => void
}

function FeedEditor({
  activeTab,
  tabs,
  onEditModeToggle,
  onDeleteFeed,
  onResetFeeds,
  onCloneFeed,
}: FeedEditorProps) {
  const {saveFeedConfig, loadFeedConfig} = useFeedStore()
  const [editingName, setEditingName] = useState("")
  const [localConfig, setLocalConfig] = useState<FeedConfig | null>(null)

  const activeTabConfig = loadFeedConfig(activeTab)

  // Helper function to get display name
  const getDisplayName = (feedId: string, defaultName: string) => {
    const config = loadFeedConfig(feedId)
    return config?.customName || defaultName
  }

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

  // Update editing name and local config when active tab changes
  useEffect(() => {
    const activeTabData = tabs.find((t) => t.id === activeTab)
    if (activeTabData) {
      const config = loadFeedConfig(activeTab)
      if (config) {
        const displayName = config.customName || activeTabData.name
        setEditingName(displayName)
        setLocalConfig(config)
      }
    }
  }, [activeTab, tabs])

  // Helper function to save config if changed
  const saveConfigIfChanged = () => {
    if (
      localConfig &&
      activeTabConfig &&
      JSON.stringify(localConfig) !== JSON.stringify(activeTabConfig)
    ) {
      saveFeedConfig(activeTab, localConfig)
    }
  }

  // Debounced commit to store
  useEffect(() => {
    if (!localConfig || !activeTabConfig) return

    const timer = setTimeout(saveConfigIfChanged, 1000)
    return () => clearTimeout(timer)
  }, [localConfig, activeTab, activeTabConfig])

  // Apply changes immediately when component unmounts (editor closes)
  useEffect(() => {
    return saveConfigIfChanged
  }, [localConfig, activeTab, activeTabConfig])

  // Update local config immediately
  const updateLocalConfig = (field: keyof FeedConfig, value: unknown) => {
    setLocalConfig((prev) => (prev ? {...prev, [field]: value} : null))
  }

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setEditingName(newName)
    // Update local config instead of directly saving to store
    updateLocalConfig("customName", newName.trim() || undefined)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      const activeTabData = tabs.find((t) => t.id === activeTab)
      if (activeTabData) {
        setEditingName(getDisplayName(activeTab, activeTabData.name))
      }
    }
  }

  const handleClone = () => {
    onCloneFeed(activeTab)
  }

  const updateConfig = updateLocalConfig

  if (!localConfig) return null

  return (
    <div className="flex flex-col gap-4 mt-4 p-4 border border-base-300 rounded-lg">
      <div className="flex justify-between items-center">
        <div className="text-lg font-semibold">
          Edit &quot;{getDisplayName(activeTab, localConfig.name)}&quot;
        </div>
        <button
          onClick={handleClone}
          className="btn btn-sm btn-neutral"
          title="Clone this feed"
        >
          <RiFileCopyLine className="w-4 h-4" />
          Clone
        </button>
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
                  // Enable with default value of 1
                  updateConfig("followDistance", 1)
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
        <div className="flex-1">
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
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-3">Relays</span>
        <div className="flex-1">
          <RelaySelector
            selectedRelay={localConfig.relayUrls?.[0] || ""}
            onRelaySelect={(relay) => {
              updateConfig("relayUrls", relay ? [relay] : undefined)
            }}
            placeholder="Default relays"
            className="select select-bordered select-sm w-full text-sm"
            showCustomInput={true}
          />
          <span className="text-xs text-base-content/50 mt-1 block">
            Leave empty to use default relays
          </span>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-col gap-2">{renderCommonCheckboxes(updateConfig)}</div>

      {/* Action Buttons */}
      <div className="flex justify-between gap-2 pt-2 border-t border-base-300">
        <button
          onClick={onEditModeToggle}
          className="btn btn-sm btn-primary"
          title="Done editing"
        >
          Done
        </button>
        <div className="flex flex-row gap-2">
          <button
            onClick={onResetFeeds}
            className="btn btn-sm btn-neutral"
            title="Reset all feeds"
          >
            Reset all feeds
          </button>
          <button
            onClick={() => onDeleteFeed(activeTab)}
            className="btn btn-sm btn-neutral"
            title="Delete feed"
            disabled={tabs.length <= 1}
          >
            <RiDeleteBinLine className="w-4 h-4" />
            Delete feed
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeedEditor
