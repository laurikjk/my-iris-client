import {useSettingsStore} from "@/stores/settings"
import {useIsLargeScreen} from "./useIsLargeScreen"

export function useIsTwoColumnLayout() {
  const {appearance} = useSettingsStore()
  const isLargeScreen = useIsLargeScreen()
  
  return !appearance.singleColumnLayout && isLargeScreen
}