export function matchPath(
  pathname: string,
  pattern: string
): {params: Record<string, string>} | null {
  // Convert route pattern to regex
  const paramNames: string[] = []
  const segments = pattern.split("/")

  // Check if last segment is wildcard
  const hasWildcard = segments[segments.length - 1] === "*"

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

  // If pattern ends with wildcard, make it optional (could be empty)
  const regexStr = hasWildcard ? `^${regexPattern}$` : `^${regexPattern}$`
  const regex = new RegExp(regexStr)
  const match = pathname.match(regex)

  if (!match) return null

  const params: Record<string, string> = {}
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1] || ""
  })

  return {params}
}

export function createPath(pattern: string, params: Record<string, string>): string {
  let path = pattern
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(`:${key}`, value).replace(`:${key}?`, value)
  })
  return path
}
