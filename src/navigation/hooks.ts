import {useCallback} from "react"
import {useNavigation} from "./NavigationProvider"
import {NavigateOptions} from "./types"

export function useNavigate() {
  const {navigate, replace} = useNavigation()

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        // Handle relative navigation
        window.history.go(to)
      } else {
        if (options?.replace) {
          replace(to)
        } else {
          navigate(to, options)
        }
      }
    },
    [navigate, replace]
  )
}

export function useLocation() {
  const {currentPath} = useNavigation()

  return {
    pathname: currentPath,
    search: "",
    hash: "",
    state: {} as Record<string, unknown>,
    key: currentPath,
  }
}

export function useParams(): Record<string, string> {
  const {currentParams} = useNavigation()
  return currentParams
}
