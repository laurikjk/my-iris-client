import {useSettingsStore} from "@/stores/settings"
import {ChangeEvent} from "react"

function AppearanceSettings() {
  const {appearance, updateAppearance} = useSettingsStore()

  function handleThemeChange(e: ChangeEvent<HTMLSelectElement>) {
    updateAppearance({theme: e.target.value})
  }

  function handleTwoColumnLayoutChange(e: ChangeEvent<HTMLInputElement>) {
    updateAppearance({twoColumnLayout: e.target.checked})
  }

  function handleLimitedMaxWidthChange(e: ChangeEvent<HTMLInputElement>) {
    updateAppearance({limitedMaxWidth: e.target.checked})
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Appearance</h1>
      <div className="flex flex-col gap-4">
        <div>
          <p>Theme</p>
          <div className="mt-2">
            <select
              className="select select-primary"
              value={appearance.theme}
              onChange={handleThemeChange}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="iris">Iris</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={appearance.twoColumnLayout}
              onChange={handleTwoColumnLayoutChange}
            />
            <span>Two column layout</span>
          </label>
          <p className="text-sm text-base-content/60 mt-1">
            Show feed and content side by side on large screens
          </p>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={appearance.limitedMaxWidth}
              onChange={handleLimitedMaxWidthChange}
            />
            <span>Limited maximum width</span>
          </label>
          <p className="text-sm text-base-content/60 mt-1">
            Constrain content to a maximum width for better readability on wide screens
          </p>
        </div>
      </div>
    </div>
  )
}

export default AppearanceSettings
