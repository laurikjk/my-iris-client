import {useCallback, useContext} from "react"
import {useNavigation} from "./NavigationProvider"
import {NavigateOptions} from "./types"
import {RouteContext} from "./RouteContext"

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
  // First check if we're in a RouteContext (stack item)
  const routeContext = useContext(RouteContext)
  const {currentParams} = useNavigation()

  // Use RouteContext params if available, otherwise use navigation params
  return routeContext?.params || currentParams
}
