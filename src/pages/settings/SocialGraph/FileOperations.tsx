import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import {saveToFile, loadFromFile, loadAndMerge} from "@/utils/socialGraph"

interface FileOperationsProps {
  onClearGraph: () => void
  onResetGraph: () => void
}

export function FileOperations({onClearGraph, onResetGraph}: FileOperationsProps) {
  return (
    <SettingsGroup title="File Operations">
      <SettingsButton label="Save to file" onClick={() => saveToFile()} />

      <SettingsButton label="Load from file" onClick={() => loadFromFile()} />

      <SettingsButton label="Load & merge" onClick={() => loadAndMerge()} />

      <SettingsButton label="Clear graph" onClick={onClearGraph} variant="destructive" />

      <SettingsButton
        label="Reset graph"
        onClick={onResetGraph}
        variant="warning"
        isLast
      />
    </SettingsGroup>
  )
}
