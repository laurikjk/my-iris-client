import React, {useContext} from "react"
import {useLocation} from "./hooks"
import {matchPath} from "./utils"
import {RouteBaseContext} from "./Router"

interface RouteProps {
  path: string
  element: React.ReactElement
}

export const Route = (() => null) as unknown as (props: RouteProps) => null

interface RoutesProps {
  children: React.ReactNode
}

export const Routes = ({children}: RoutesProps) => {
  const location = useLocation()
  const parentBase = useContext(RouteBaseContext)

  // Extract routes from children
  const routes = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<RouteProps> =>
      React.isValidElement(child) && child.type === Route
  )

  // Find matching route
  for (const route of routes) {
    const {path, element} = route.props

    // Handle relative paths for nested routes
    let fullPath: string
    let newBase = parentBase

    if (path.startsWith("/")) {
      // Absolute path
      fullPath = path
      // Update base for wildcard routes
      if (path.endsWith("/*")) {
        newBase = path.slice(0, -2)
      }
    } else {
      // Relative path - use parent base
      if (path === "/" || path === "") {
        // Root of nested route - match exact base path
        fullPath = parentBase || "/"
      } else if (path === "*") {
        // Catch-all
        fullPath = parentBase ? `${parentBase}/*` : "/*"
      } else {
        // Nested path
        fullPath = parentBase ? `${parentBase}/${path}` : `/${path}`
      }
    }

    const match = matchPath(location.pathname, fullPath)
    if (match) {
      // If this route matches and contains nested routes, provide the base context
      return (
        <RouteBaseContext.Provider value={newBase}>{element}</RouteBaseContext.Provider>
      )
    }
  }

  return null
}

// For compatibility
export const Outlet = () => null
