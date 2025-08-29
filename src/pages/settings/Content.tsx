import {UserRow} from "@/shared/components/user/UserRow"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingToggle} from "@/shared/components/settings/SettingToggle"
import {useSettingsStore} from "@/stores/settings"
import useMutes from "@/shared/hooks/useMutes"
import {useState} from "react"

function Content() {
  const {content, updateContent} = useSettingsStore()
  const mutes = useMutes()
  const [showMutedUsers, setShowMutedUsers] = useState<boolean>(false)

  const handleToggleChange = (key: keyof typeof content) => {
    updateContent({[key]: !content[key]})
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup>
            <SettingToggle
              checked={content.hideEventsByUnknownUsers}
              onChange={() => handleToggleChange("hideEventsByUnknownUsers")}
              label="Hide posts by unknown users"
            />
            <SettingToggle
              checked={content.blurNSFW}
              onChange={() => handleToggleChange("blurNSFW")}
              label="Blur NSFW Media"
            />
            <SettingToggle
              checked={content.hidePostsByMutedMoreThanFollowed}
              onChange={() => handleToggleChange("hidePostsByMutedMoreThanFollowed")}
              label="Hide posts by users who are muted more than followed"
            />
            <SettingToggle
              checked={content.autoplayVideos}
              onChange={() => handleToggleChange("autoplayVideos")}
              label="Autoplay videos"
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="Reactions">
            <SettingToggle
              checked={content.showReactionsBar}
              onChange={() => handleToggleChange("showReactionsBar")}
              label="Show reactions bar"
            />
            <SettingToggle
              checked={content.showReactionCounts}
              onChange={() => handleToggleChange("showReactionCounts")}
              label="Show reaction counts in feed"
            />
            <SettingToggle
              checked={content.showReactionCountsInStandalone}
              onChange={() => handleToggleChange("showReactionCountsInStandalone")}
              label="Show reaction counts in post view"
            />
            <SettingToggle
              checked={!content.hideReactionsBarInStandalone}
              onChange={() => handleToggleChange("hideReactionsBarInStandalone")}
              label="Show reactions bar in standalone posts"
              disabled={!content.showReactionsBar || !content.showLikes}
            />
            <SettingToggle
              checked={!content.hideZapsBarInStandalone}
              onChange={() => handleToggleChange("hideZapsBarInStandalone")}
              label="Show zaps bar in standalone posts"
              disabled={!content.showReactionsBar || !content.showZaps}
            />
            <SettingToggle
              checked={content.showLikes}
              onChange={() => handleToggleChange("showLikes")}
              label="Show likes"
              disabled={!content.showReactionsBar}
            />
            <SettingToggle
              checked={content.showReposts}
              onChange={() => handleToggleChange("showReposts")}
              label="Show reposts"
              disabled={!content.showReactionsBar}
            />
            <SettingToggle
              checked={content.showReplies}
              onChange={() => handleToggleChange("showReplies")}
              label="Show replies"
              disabled={!content.showReactionsBar}
            />
            <SettingToggle
              checked={content.showZaps}
              onChange={() => handleToggleChange("showZaps")}
              label="Show zaps"
              isLast
              disabled={!content.showReactionsBar}
            />
          </SettingsGroup>

          <SettingsGroup title="Muted Users">
            {mutes.length > 0 ? (
              <>
                <SettingsGroupItem
                  onClick={() => setShowMutedUsers(!showMutedUsers)}
                  className="text-info"
                  isLast={!showMutedUsers}
                >
                  {showMutedUsers ? "Hide" : `Show muted users (${mutes.length})`}
                </SettingsGroupItem>
                {showMutedUsers &&
                  mutes.map((user, index) => (
                    <SettingsGroupItem key={index} isLast={index === mutes.length - 1}>
                      <UserRow pubKey={user} />
                    </SettingsGroupItem>
                  ))}
              </>
            ) : (
              <SettingsGroupItem isLast className="text-base-content/70">
                No muted users
              </SettingsGroupItem>
            )}
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default Content
