import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import {
  saveToFile,
  loadFromFile,
  loadAndMerge,
  clearGraph,
  resetGraph,
} from "@/utils/socialGraph"
export function FileOperations() {
  const handleClearGraph = async () => {
    if (
      confirm(
        "Are you sure you want to clear the entire social graph? This cannot be undone."
      )
    ) {
      await clearGraph()
    }
  }

  const handleResetGraph = async () => {
    if (
      confirm(
        "Are you sure you want to reset the social graph to default? This will replace your current graph."
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
