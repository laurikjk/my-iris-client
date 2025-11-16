import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import socialGraph, {getFollowLists, stopRecrawl} from "@/utils/socialGraph"
import {useSocialGraphStore} from "@/stores/socialGraph"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"

const {log} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export function Maintenance() {
  const crawling = useSocialGraphStore((state) => state.isRecrawling)

  const handleRecalculateDistances = () => {
    socialGraph().recalculateFollowDistances()
    const removed = socialGraph().removeMutedNotFollowedUsers()
    log("Removed", removed, "muted not followed users")
  }
  return (
    <SettingsGroup title="Maintenance">
      <SettingsGroupItem>
        <div className="flex flex-col space-y-1">
          <button onClick={handleRecalculateDistances} className="text-info text-left">
            Recalculate Follow Distances
          </button>
          <span className="text-xs text-base-content/60">Fast, no bandwidth usage</span>
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem isLast={!crawling}>
        <div className="flex flex-col space-y-1">
          <button
            onClick={() => {
              getFollowLists(socialGraph().getRoot(), false, 2)
            }}
            className="text-info text-left"
            disabled={crawling}
          >
            {crawling ? "Recrawling..." : "Recrawl follow lists"}
          </button>
          <span className="text-xs text-base-content/60">Slow, bandwidth intensive</span>
        </div>
      </SettingsGroupItem>

      {crawling && (
        <SettingsButton
          label="Stop crawling"
          onClick={stopRecrawl}
          variant="destructive"
          isLast
        />
      )}
    </SettingsGroup>
  )
}
