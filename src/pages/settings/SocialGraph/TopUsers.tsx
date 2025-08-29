import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {UserRow} from "@/shared/components/user/UserRow"
import {RiArrowRightSLine, RiArrowDownSLine} from "@remixicon/react"
import {useState} from "react"

interface TopUsersProps {
  topFollowedUsers: Array<{user: string; count: number}>
  topMutedUsers: Array<{user: string; count: number}>
  topUsersLimit: number
  onFindTopFollowed: () => void
  onFindTopMuted: () => void
}

export function TopUsers({
  topFollowedUsers,
  topMutedUsers,
  topUsersLimit,
  onFindTopFollowed,
  onFindTopMuted,
}: TopUsersProps) {
  const [showFollowed, setShowFollowed] = useState(false)
  const [showMuted, setShowMuted] = useState(false)

  const handleToggleFollowed = () => {
    if (!showFollowed && topFollowedUsers.length === 0) {
      onFindTopFollowed()
    }
    setShowFollowed(!showFollowed)
  }

  const handleToggleMuted = () => {
    if (!showMuted && topMutedUsers.length === 0) {
      onFindTopMuted()
    }
    setShowMuted(!showMuted)
  }

  return (
    <SettingsGroup title="Top Users">
      <SettingsGroupItem
        onClick={handleToggleFollowed}
        isLast={!showFollowed && !showMuted}
      >
        <div className="flex justify-between items-center">
          <span>Most Followed Users ({topUsersLimit})</span>
          {showFollowed ? (
            <RiArrowDownSLine size={20} className="text-base-content/50" />
          ) : (
            <RiArrowRightSLine size={20} className="text-base-content/50" />
          )}
        </div>
      </SettingsGroupItem>

      {showFollowed &&
        topFollowedUsers.map(({user, count}, index) => (
          <SettingsGroupItem
            key={user}
            isLast={!showMuted && index === topFollowedUsers.length - 1}
          >
            <div className="flex items-center justify-between">
              <UserRow pubKey={user} />
              <span className="text-sm text-base-content/70">{count}</span>
            </div>
          </SettingsGroupItem>
        ))}

      <SettingsGroupItem onClick={handleToggleMuted} isLast={!showMuted}>
        <div className="flex justify-between items-center">
          <span>Most Muted Users ({topUsersLimit})</span>
          {showMuted ? (
            <RiArrowDownSLine size={20} className="text-base-content/50" />
          ) : (
            <RiArrowRightSLine size={20} className="text-base-content/50" />
          )}
        </div>
      </SettingsGroupItem>

      {showMuted &&
        topMutedUsers.map(({user, count}, index) => (
          <SettingsGroupItem key={user} isLast={index === topMutedUsers.length - 1}>
            <div className="flex items-center justify-between">
              <UserRow pubKey={user} />
              <span className="text-sm text-base-content/70">{count}</span>
            </div>
          </SettingsGroupItem>
        ))}
    </SettingsGroup>
  )
}
