import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {UserRow} from "@/shared/components/user/UserRow"
import {RiArrowRightSLine, RiArrowDownSLine} from "@remixicon/react"
import {useState} from "react"
import socialGraph from "@/utils/socialGraph"

const TOP_USERS_LIMIT = 20

export function TopUsers() {
  const [showFollowed, setShowFollowed] = useState(false)
  const [showMuted, setShowMuted] = useState(false)
  const [topFollowedUsers, setTopFollowedUsers] = useState<
    Array<{user: string; count: number}>
  >([])
  const [topMutedUsers, setTopMutedUsers] = useState<
    Array<{user: string; count: number}>
  >([])

  const getTopNMostFollowedUsers = (n: number) => {
    const userFollowerCounts: Array<{user: string; count: number}> = []

    for (const user of socialGraph()) {
      const followers = socialGraph().getFollowersByUser(user)
      userFollowerCounts.push({user, count: followers.size})
    }

    userFollowerCounts.sort((a, b) => b.count - a.count)
    return userFollowerCounts.slice(0, n)
  }

  const getTopNMostMutedUsers = (n: number) => {
    const userMuteCounts: Array<{user: string; count: number}> = []

    for (const user of socialGraph()) {
      const mutedBy = socialGraph().getUserMutedBy(user)
      userMuteCounts.push({user, count: mutedBy.size})
    }

    userMuteCounts.sort((a, b) => b.count - a.count)
    return userMuteCounts.slice(0, n)
  }

  const handleFindTopFollowed = () => {
    setTopFollowedUsers(getTopNMostFollowedUsers(TOP_USERS_LIMIT))
  }

  const handleFindTopMuted = () => {
    setTopMutedUsers(getTopNMostMutedUsers(TOP_USERS_LIMIT))
  }

  const handleToggleFollowed = () => {
    if (!showFollowed && topFollowedUsers.length === 0) {
      handleFindTopFollowed()
    }
    setShowFollowed(!showFollowed)
  }

  const handleToggleMuted = () => {
    if (!showMuted && topMutedUsers.length === 0) {
      handleFindTopMuted()
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
          <span>Most Followed Users ({TOP_USERS_LIMIT})</span>
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
          <span>Most Muted Users ({TOP_USERS_LIMIT})</span>
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
