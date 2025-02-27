import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {UserRow} from "@/shared/components/user/UserRow"
import useMutes from "@/shared/hooks/useMutes"
import {useState} from "react"

function Content() {
  const [blurNSFW, setBlurNSFW] = useLocalState<boolean>("settings/blurNSFW", true)
  const [hideEventsByUnknownUsers, setHideEventsByUnknownUsers] = useLocalState<boolean>(
    "settings/hideEventsByUnknownUsers",
    true
  )
  const [hidePostsByMutedMoreThanFollowed, setHidePostsByMutedMoreThanFollowed] =
    useLocalState<boolean>("settings/hidePostsByMutedMoreThanFollowed", true)
  const mutes = useMutes()
  const [showMutedUsers, setShowMutedUsers] = useState<boolean>(false)
  const [autoplayVideos, setAutoplayVideos] = useLocalState<boolean>(
    "settings/autoplayVideos",
    true
  )

  const handleToggleChange = (setter: (value: boolean) => void, value: boolean) => {
    setter(!value)
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Content</h1>
      <div className="space-y-4">
        <SettingToggle
          checked={hideEventsByUnknownUsers}
          onChange={() =>
            handleToggleChange(setHideEventsByUnknownUsers, hideEventsByUnknownUsers)
          }
          label="Hide posts by unknown users"
        />
        <SettingToggle
          checked={blurNSFW}
          onChange={() => handleToggleChange(setBlurNSFW, blurNSFW)}
          label="Blur NSFW Media"
        />
        <SettingToggle
          checked={hidePostsByMutedMoreThanFollowed}
          onChange={() =>
            handleToggleChange(
              setHidePostsByMutedMoreThanFollowed,
              hidePostsByMutedMoreThanFollowed
            )
          }
          label="Hide posts by users who are muted more than followed"
        />
        <SettingToggle
          checked={autoplayVideos}
          onChange={() => handleToggleChange(setAutoplayVideos, autoplayVideos)}
          label="Autoplay Videos"
        />
      </div>
      <div className="mt-6">
        <h2 className="text-xl mb-2">Muted Users</h2>
        {mutes.length > 0 ? (
          <>
            <button
              onClick={() => setShowMutedUsers(!showMutedUsers)}
              className="mb-2 text-info link"
            >
              {showMutedUsers ? "Hide" : `Show muted users (${mutes.length})`}
            </button>
            {showMutedUsers && (
              <ul>
                {mutes.map((user, index) => (
                  <li className="mb-2" key={index}>
                    <UserRow pubKey={user} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p>No muted users</p>
        )}
      </div>
    </div>
  )
}

interface SettingToggleProps {
  checked: boolean
  onChange: () => void
  label: string
}

function SettingToggle({checked, onChange, label}: SettingToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="toggle toggle-primary"
      />
      <span>{label}</span>
    </div>
  )
}

export default Content
