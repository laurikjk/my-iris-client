import {useSettingsStore} from "@/stores/settings"
import {ChangeEvent} from "react"

function PrivacySettings() {
  const {privacy, updatePrivacy} = useSettingsStore()

  function handleEnableAnalyticsChange(e: ChangeEvent<HTMLInputElement>) {
    updatePrivacy({enableAnalytics: e.target.checked})
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Privacy</h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              className="checkbox checkbox-primary mr-2"
              checked={privacy.enableAnalytics}
              onChange={handleEnableAnalyticsChange}
            />
            <span>Allow anonymous usage statistics collection</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default PrivacySettings
