import React, {useEffect, useState} from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useFeedStore, useEnabledFeedIds, type TabConfig} from "@/stores/feed"
import {RiDeleteBinLine, RiDragMove2Line, RiEqualizerFill} from "@remixicon/react"
import {feedCache} from "@/utils/memcache"

interface FeedTab {
  name: string
  id: string
  showRepliedTo?: boolean
  fetchFilterFn?: (e: NDKEvent) => boolean
  filter?: {
    kinds?: number[]
    since?: number
    limit?: number
  }
  displayFilterFn?: (e: NDKEvent) => boolean
  sortLikedPosts?: boolean
}

interface FeedTabsProps {
  allTabs: FeedTab[]
}

function FeedTabs({allTabs}: FeedTabsProps) {
  const {
    activeHomeTab: activeTab,
    setActiveHomeTab: setActiveTab,
    reorderFeeds,
    deleteFeed,
    saveFeedConfig,
    loadFeedConfig,
    resetAllFeedsToDefaults,
  } = useFeedStore()
  const enabledFeedIds = useEnabledFeedIds()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [localConfig, setLocalConfig] = useState<TabConfig | null>(null)

  // Filter and order tabs based on enabled feed IDs from store
  const tabs = React.useMemo(() => {
    const tabsMap = new Map(allTabs.map((tab) => [tab.id, tab]))
    return enabledFeedIds
      .map((id) => tabsMap.get(id))
      .filter((tab): tab is FeedTab => tab !== undefined)
  }, [allTabs, enabledFeedIds])

  const activeTabConfig = loadFeedConfig(activeTab)

  // Helper functions to work with the unified config
  const getDisplayName = (feedId: string, defaultName: string) => {
    const config = loadFeedConfig(feedId)
    return config?.customName || defaultName
  }

  const setDisplayName = (feedId: string, name: string) => {
    if (name.trim()) {
      saveFeedConfig(feedId, {customName: name.trim()})
    } else {
      saveFeedConfig(feedId, {customName: undefined})
    }
  }

  // Update editing name and local config when active tab changes
  useEffect(() => {
    if (editMode) {
      const activeTabData = tabs.find((t) => t.id === activeTab)
      if (activeTabData) {
        setEditingName(getDisplayName(activeTab, activeTabData.name))
      }
    }
    // Initialize local config
    if (activeTabConfig) {
      setLocalConfig(activeTabConfig)
    }
  }, [editMode, activeTab, tabs, activeTabConfig])

  // Debounced commit to store
  useEffect(() => {
    if (!localConfig || !activeTabConfig) return

    const timer = setTimeout(() => {
      // Only commit if local config differs from store config
      if (JSON.stringify(localConfig) !== JSON.stringify(activeTabConfig)) {
        saveFeedConfig(activeTab, localConfig)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [localConfig, activeTab, activeTabConfig, saveFeedConfig])

  // Update local config immediately
  const updateLocalConfig = (field: keyof TabConfig, value: unknown) => {
    setLocalConfig((prev) => (prev ? {...prev, [field]: value} : null))
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!editMode) return
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!editMode) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!editMode) return
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderFeeds(draggedIndex, dropIndex)
    }
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    if (!editMode) return
    setDraggedIndex(null)
  }

  const toggleEditMode = () => {
    setEditMode(!editMode)
    setDraggedIndex(null)
    setEditingName("")
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setEditingName(newName)
    if (activeTab) {
      setDisplayName(activeTab, newName)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      const activeTabData = tabs.find((t) => t.id === activeTab)
      if (activeTabData) {
        setEditingName(getDisplayName(activeTab, activeTabData.name))
      }
    }
  }

  const handleDeleteFeed = (feedId: string) => {
    if (tabs.length <= 1) {
      return // Don't allow deleting the last tab
    }
    if (
      confirm(
        `Delete feed "${getDisplayName(feedId, tabs.find((t) => t.id === feedId)?.name || "")}"?`
      )
    ) {
      // If deleting the active tab, switch to the first remaining tab
      if (feedId === activeTab) {
        const remainingTabs = tabs.filter((t) => t.id !== feedId)
        if (remainingTabs.length > 0) {
          setActiveTab(remainingTabs[0].id)
        }
      }

      deleteFeed(feedId)
    }
  }

  const updateConfig = updateLocalConfig

  const handleResetFeeds = () => {
    if (confirm("Reset all feeds to defaults?")) {
      console.log("User confirmed reset")
      setEditMode(false)
      feedCache.clear()
      resetAllFeedsToDefaults()
      console.log("Reset function called")
    }
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-row items-center gap-2 overflow-x-auto max-w-[100vw] scrollbar-hide">
        {/* Edit button */}
        <button
          onClick={toggleEditMode}
          className={`btn btn-sm btn-circle ${editMode ? "btn-primary" : "btn-neutral"}`}
          title={editMode ? "Done editing" : "Edit feeds"}
        >
          <RiEqualizerFill className="w-4 h-4" />
        </button>

        {editMode && <RiDragMove2Line className="text-base-content/50 w-5 h-5" />}

        {tabs.map((t, index) => (
          <div key={t.id} className="flex flex-col items-center gap-1">
            <button
              draggable={editMode}
              onDragStart={editMode ? (e) => handleDragStart(e, index) : undefined}
              onDragOver={editMode ? handleDragOver : undefined}
              onDrop={editMode ? (e) => handleDrop(e, index) : undefined}
              onDragEnd={editMode ? handleDragEnd : undefined}
              className={`btn btn-sm ${editMode ? "cursor-move" : "cursor-pointer"} ${
                activeTab === t.id ? "btn-primary" : "btn-neutral"
              } ${draggedIndex === index ? "opacity-50" : ""}`}
              onClick={() => setActiveTab(t.id)}
              title={editMode ? "Click to edit name, drag to reorder" : "Click to select"}
            >
              {getDisplayName(t.id, t.name)}
            </button>
          </div>
        ))}
      </div>

      {editMode && localConfig && (
        <div className="flex flex-col gap-4 mt-4 p-4 border border-base-300 rounded-lg">
          <div className="text-lg font-semibold">
            Edit &quot;{getDisplayName(activeTab, localConfig.name)}&quot;
          </div>

          {/* Basic Settings */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70 w-20">Name</span>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70 w-20">Follow Distance</span>
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
              placeholder="None"
            />
            <span className="text-xs text-base-content/50">
              Max degrees of separation (1=follows only)
            </span>
          </div>

          {/* Filter Kinds */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70 w-20">Event Kinds</span>
            <input
              type="text"
              value={localConfig.filter?.kinds?.join(",") || ""}
              onChange={(e) => {
                const inputValue = e.target.value.trim()
                const currentFilter = localConfig.filter || {}
                if (inputValue === "") {
                  // Remove kinds property if input is empty
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
                  const kinds = inputValue
                    .split(",")
                    .map((k) => parseInt(k.trim()))
                    .filter((k) => !isNaN(k))
                  updateConfig("filter", {...currentFilter, kinds})
                }
              }}
              className="input input-sm flex-1 text-sm"
              placeholder="1,6,7"
            />
            <span className="text-xs text-base-content/50">Comma-separated numbers</span>
          </div>

          {/* Search Term */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70 w-20">Search</span>
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
              className="input input-sm flex-1 text-sm"
              placeholder="Search terms"
            />
            <span className="text-xs text-base-content/50">
              Text to search for in posts
            </span>
          </div>

          {/* Limit */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70 w-20">Limit</span>
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
            <span className="text-xs text-base-content/50">
              Max events to initially fetch
            </span>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!(localConfig.hideReplies ?? false)}
                onChange={(e) => updateConfig("hideReplies", !e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm text-base-content/70">Show replies</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.showRepliedTo ?? true}
                onChange={(e) => updateConfig("showRepliedTo", e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm text-base-content/70">Show replied-to posts</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.requiresMedia ?? false}
                onChange={(e) => updateConfig("requiresMedia", e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm text-base-content/70">
                Only show posts with media
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.sortLikedPosts ?? false}
                onChange={(e) => updateConfig("sortLikedPosts", e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm text-base-content/70">Sort by popularity</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.excludeSeen ?? false}
                onChange={(e) => updateConfig("excludeSeen", e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm text-base-content/70">Hide seen posts</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between gap-2 pt-2 border-t border-base-300">
            <button
              onClick={toggleEditMode}
              className="btn btn-sm btn-primary"
              title="Done editing"
            >
              Done
            </button>
            <div className="flex flex-row gap-2">
              <button
                onClick={() => handleResetFeeds()}
                className="btn btn-sm btn-neutral"
                title="Reset all feeds"
              >
                Reset all feeds
              </button>
              <button
                onClick={() => handleDeleteFeed(activeTab)}
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
      )}
    </div>
  )
}

export default FeedTabs
export type {FeedTab}
