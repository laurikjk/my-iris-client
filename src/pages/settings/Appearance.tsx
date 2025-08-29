import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {useSettingsStore} from "@/stores/settings"
import {ChangeEvent} from "react"

function AppearanceSettings() {
  const {appearance, updateAppearance} = useSettingsStore()

  function handleThemeChange(e: ChangeEvent<HTMLSelectElement>) {
    updateAppearance({theme: e.target.value})
  }

  function handleSingleColumnLayoutChange(e: ChangeEvent<HTMLInputElement>) {
    updateAppearance({singleColumnLayout: e.target.checked})
  }

  function handleLimitedMaxWidthChange(e: ChangeEvent<HTMLInputElement>) {
    updateAppearance({limitedMaxWidth: e.target.checked})
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup title="Theme">
            <SettingsGroupItem isLast>
              <div className="flex justify-between items-center">
                <span>Color scheme</span>
                <select
                  className="select select-sm bg-base-200 border-base-content/20"
                  value={appearance.theme}
                  onChange={handleThemeChange}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="iris">Iris</option>
                  <option value="system">System</option>
                </select>
              </div>
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="Layout">
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Single column layout</span>
                  <span className="text-sm text-base-content/60">
                    Show content in one column on large screens
                  </span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={appearance.singleColumnLayout}
                  onChange={handleSingleColumnLayoutChange}
                />
              </div>
            </SettingsGroupItem>

            <SettingsGroupItem isLast>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Limited maximum width</span>
                  <span className="text-sm text-base-content/60">
                    Constrain content width for better readability
                  </span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={appearance.limitedMaxWidth}
                  onChange={handleLimitedMaxWidthChange}
                />
              </div>
            </SettingsGroupItem>
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default AppearanceSettings
