export function matchPath(
  pathname: string,
  pattern: string
): {params: Record<string, string>} | null {
  // Handle wildcard patterns like /settings/*
  if (pattern.endsWith("/*")) {
    const basePattern = pattern.slice(0, -2)
    if (pathname === basePattern || pathname.startsWith(basePattern + "/")) {
      return {params: {"*": pathname.slice(basePattern.length + 1) || ""}}
    }
    return null
  }

  // Convert route pattern to regex
  const paramNames: string[] = []
  const regexPattern = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        const paramName = segment.slice(1).replace("?", "")
        const isOptional = segment.endsWith("?")
        paramNames.push(paramName)
        return isOptional ? "([^/]*)" : "([^/]+)"
      }
      if (segment === "*") {
        paramNames.push("*")
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

export function createPath(pattern: string, params: Record<string, string>): string {
  let path = pattern
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(`:${key}`, value).replace(`:${key}?`, value)
  })
  return path
}
