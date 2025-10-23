import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import {
  saveToFile,
  loadFromFile,
  loadAndMerge,
  clearGraph,
  resetGraph,
} from "@/utils/socialGraph"
import {confirm} from "@/utils/utils"
export function FileOperations() {
  const handleClearGraph = async () => {
    if (
      await confirm(
        "This cannot be undone.",
        "Are you sure you want to clear the entire social graph?"
      )
    ) {
      await clearGraph()
    }
  }

  const handleResetGraph = async () => {
    if (
      await confirm(
        "This will replace your current graph.",
        "Are you sure you want to reset the social graph to default?"
      )
    ) {
      await resetGraph()
    }
  }
  return (
    <SettingsGroup title="File Operations">
      <SettingsButton label="Save to file" onClick={() => saveToFile()} />

      <SettingsButton label="Load from file" onClick={() => loadFromFile()} />

      <SettingsButton label="Load & merge" onClick={() => loadAndMerge()} />

      <SettingsButton
        label="Clear graph"
        onClick={handleClearGraph}
        variant="destructive"
      />

      <SettingsButton
        label="Reset graph"
        onClick={handleResetGraph}
        variant="warning"
        isLast
      />
    </SettingsGroup>
  )
}
