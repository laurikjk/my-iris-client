import {useFeedStore, type FeedConfig} from "@/stores/feed"
import FeedEditor from "./FeedEditor"

interface StoredFeedEditorProps {
  activeTab: string
  tabs: FeedConfig[]
  onEditModeToggle: () => void
  onDeleteFeed: (feedId: string) => void
  onResetFeeds: () => void
  onCloneFeed: (feedId: string) => void
}

/**
 * Wrapper around FeedEditor that handles feed store interactions
 */
function StoredFeedEditor({
  activeTab,
  tabs,
  onEditModeToggle,
  onDeleteFeed,
  onResetFeeds,
  onCloneFeed,
}: StoredFeedEditorProps) {
  const {saveFeedConfig, loadFeedConfig} = useFeedStore()

  const activeTabData = tabs.find((t) => t.id === activeTab)
  const storedConfig = loadFeedConfig(activeTab)

  if (!activeTabData || !storedConfig) {
    return null
  }

  const handleConfigChange = (config: FeedConfig) => {
    saveFeedConfig(activeTab, config)
  }

  const handleDelete = () => {
    onDeleteFeed(activeTab)
  }

  const handleClone = () => {
    onCloneFeed(activeTab)
  }

  return (
    <FeedEditor
      feedConfig={storedConfig}
      onConfigChange={handleConfigChange}
      onClose={onEditModeToggle}
      onDelete={handleDelete}
      onReset={onResetFeeds}
      onClone={handleClone}
      showDeleteButton={tabs.length > 1}
      showResetButton={true}
      showCloneButton={true}
    />
  )
}

export default StoredFeedEditor
