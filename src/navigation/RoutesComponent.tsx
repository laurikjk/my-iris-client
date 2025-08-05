import React from "react"
import {useLocation} from "./hooks"
import {matchPath} from "./utils"

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

    if (path.startsWith("/")) {
      // Absolute path
      fullPath = path
    } else {
      // For nested routes like those in /settings/*, /chats/*
      // We need to find the parent route path
      const segments = location.pathname.split("/").filter(Boolean)

      if (segments.length >= 1) {
        const parentPath = "/" + segments[0]

        if (path === "/" || path === "") {
          // Root of nested route
          fullPath = parentPath
        } else if (path === "*") {
          // Catch-all
          fullPath = `${parentPath}/*`
        } else {
          // Nested path
          fullPath = `${parentPath}/${path}`
        }
      } else {
        fullPath = `/${path}`
      }
    }

    const match = matchPath(location.pathname, fullPath)
    if (match) {
      return element
    }
  }

  return null
}

// For compatibility
export const Outlet = () => null
