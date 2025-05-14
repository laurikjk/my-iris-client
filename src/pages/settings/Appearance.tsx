import {useSettingsStore} from "@/stores/settings"
import {ChangeEvent} from "react"

function AppearanceSettings() {
  const {appearance, updateAppearance} = useSettingsStore()

  function handleThemeChange(e: ChangeEvent<HTMLSelectElement>) {
    updateAppearance({theme: e.target.value})
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
      </div>
    </div>
  )
}

export default AppearanceSettings
