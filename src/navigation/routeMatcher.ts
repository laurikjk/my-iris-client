import {routes} from "./routes"
import {matchPath} from "./utils"

export function getRouteParams(pathname: string): Record<string, string> {
  for (const route of routes) {
    const match = matchPath(pathname, route.path)
    if (match) {
      return match.params
    }
  }
  return {}
}