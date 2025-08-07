export function matchPath(
  pathname: string,
  pattern: string
): {params: Record<string, string>} | null {
  // Special handling for /* patterns - should match both /path and /path/...
  if (pattern.endsWith("/*")) {
    const basePath = pattern.slice(0, -2)
    if (pathname === basePath || pathname.startsWith(basePath + "/")) {
      const wildcardPart =
        pathname === basePath ? "" : pathname.slice(basePath.length + 1)
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
  const match = pathname.match(regex)

  if (!match) return null

  const params: Record<string, string> = {}
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1] || ""
  })

  return {params}
}
