export function matchPath(
  pathname: string,
  pattern: string
): {params: Record<string, string>} | null {
  // Strip query params for matching
  const pathOnly = pathname.split("?")[0]

  // Special handling for /* patterns - should match both /path and /path/...
  if (pattern.endsWith("/*")) {
    const basePath = pattern.slice(0, -2)
    if (pathOnly === basePath || pathOnly.startsWith(basePath + "/")) {
      const wildcardPart =
        pathOnly === basePath ? "" : pathOnly.slice(basePath.length + 1)
      return {params: {"*": wildcardPart}}
    }
    return null
  }

  // Convert route pattern to regex
  const paramNames: string[] = []
  const segments = pattern.split("/")

  const regexPattern = segments
    .map((segment) => {
      if (segment.startsWith(":")) {
        const paramName = segment.slice(1).replace("?", "")
        const isOptional = segment.endsWith("?")
        paramNames.push(paramName)
        return isOptional ? "([^/]*)" : "([^/]+)"
      }
      if (segment === "*") {
        paramNames.push("*")
        // For wildcard at the end, match everything including nothing
        return "(.*)"
      }
      return segment
    })
    .join("/")

  const regex = new RegExp(`^${regexPattern}$`)
  const match = pathOnly.match(regex)

  if (!match) return null

  const params: Record<string, string> = {}
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1] || ""
  })

  return {params}
}

export function getCurrentRouteInfo(pathname: string) {
  // Strip query params for route matching
  const pathOnly = pathname.split("?")[0]

  // Define the search routes we care about - order matters! Check more specific routes first
  const searchRoutes = [
    "/map",
    "/map/:query",
    "/u",
    "/u/:query",
    "/search",
    "/search/:query",
    "/m",
    "/m/:category",
  ]

  // Check if current path matches any search route
  for (const route of searchRoutes) {
    const match = matchPath(pathOnly, route)
    if (match) {
      // Return the base route type - check /map first to avoid /m conflict
      if (route.startsWith("/map")) {
        return {type: "map", baseRoute: "/map"}
      }
      if (route.startsWith("/u")) {
        return {type: "user-search", baseRoute: "/u"}
      }
      if (route.startsWith("/search")) {
        return {type: "search", baseRoute: "/search"}
      }
      if (route.startsWith("/m")) {
        return {type: "market", baseRoute: "/m"}
      }
    }
  }

  // Check for home routes
  if (pathOnly === "/" || matchPath(pathOnly, "/home")) {
    return {type: "home", baseRoute: "/"}
  }

  return {type: "other", baseRoute: null}
}
