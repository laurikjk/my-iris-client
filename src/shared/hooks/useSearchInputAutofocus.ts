import {useEffect, RefObject} from "react"
import {useNavigation} from "@/navigation"
import {isAboveMobileBreakpoint} from "@/utils/utils"

export function useSearchInputAutofocus(
  inputRef: RefObject<HTMLInputElement>,
  routePrefix: string
) {
  const {currentPath} = useNavigation()

  useEffect(() => {
    if (!isAboveMobileBreakpoint()) return
    if (!currentPath.startsWith(routePrefix)) return

    const checkVisibility = () => {
      const input = inputRef.current
      if (input && input.offsetParent !== null) {
        input.focus()
      }
    }

    const timer = setTimeout(checkVisibility, 0)
    return () => clearTimeout(timer)
  }, [currentPath, inputRef, routePrefix])
}
