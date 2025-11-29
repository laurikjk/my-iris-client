import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {useGraphSize} from "@/utils/socialGraph"

export function Statistics() {
  const socialGraphSize = useGraphSize()
  return (
    <>
      <SettingsGroup title="Statistics">
        <SettingsGroupItem>
          <div className="flex justify-between items-center">
            <span>Users</span>
            <span className="text-base-content/70">{socialGraphSize.users}</span>
          </div>
        </SettingsGroupItem>

        <SettingsGroupItem>
          <div className="flex justify-between items-center">
            <span>Follow relationships</span>
            <span className="text-base-content/70">{socialGraphSize.follows}</span>
          </div>
        </SettingsGroupItem>

        <SettingsGroupItem isLast>
          <div className="flex justify-between items-center">
            <span>Mutes</span>
            <span className="text-base-content/70">{socialGraphSize.mutes}</span>
          </div>
        </SettingsGroupItem>
      </SettingsGroup>

      <SettingsGroup title="Follow Distances">
        {Object.entries(socialGraphSize.sizeByDistance).map(
          ([distance, size], index, array) => (
            <SettingsGroupItem key={distance} isLast={index === array.length - 1}>
              <div className="flex justify-between items-center">
                <span>Distance {distance}</span>
                <span className="text-base-content/70">{size}</span>
              </div>
            </SettingsGroupItem>
          )
        )}
      </SettingsGroup>
    </>
  )
}
