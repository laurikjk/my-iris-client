import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import socialGraph, {getFollowLists, stopRecrawl} from "@/utils/socialGraph"

interface MaintenanceProps {
  isCrawling: boolean
  setIsCrawling: (crawling: boolean) => void
  onRecalculateDistances: () => void
}

export function Maintenance({
  isCrawling,
  setIsCrawling,
  onRecalculateDistances,
}: MaintenanceProps) {
  return (
    <SettingsGroup title="Maintenance">
      <SettingsGroupItem>
        <div className="flex flex-col space-y-1">
          <button onClick={onRecalculateDistances} className="text-info text-left">
            Recalculate Follow Distances
          </button>
          <span className="text-xs text-base-content/60">Fast, no bandwidth usage</span>
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem isLast={!isCrawling}>
        <div className="flex flex-col space-y-1">
          <button
            onClick={() => {
              setIsCrawling(true)
              getFollowLists(socialGraph().getRoot(), false, 2)
            }}
            className="text-info text-left"
            disabled={isCrawling}
          >
            {isCrawling ? "Recrawling..." : "Recrawl follow lists"}
          </button>
          <span className="text-xs text-base-content/60">Slow, bandwidth intensive</span>
        </div>
      </SettingsGroupItem>

      {isCrawling && (
        <SettingsButton
          label="Stop crawling"
          onClick={() => {
            stopRecrawl()
            setIsCrawling(false)
          }}
          variant="destructive"
          isLast
        />
      )}
    </SettingsGroup>
  )
}
