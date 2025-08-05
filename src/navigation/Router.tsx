import {Suspense} from "react"
import {useNavigation} from "./NavigationProvider"
import {routes} from "./routes"
import {matchPath} from "./utils"
import {LoadingFallback} from "@/shared/components/LoadingFallback"

export const Router = () => {
  const {currentPath, stack} = useNavigation()
  const currentStackItem = stack[stack.length - 1]

  // Find matching route
  let matchedRoute = null
  let params: Record<string, string> = {}

  for (const route of routes) {
    const match = matchPath(currentPath, route.path)
    if (match) {
      matchedRoute = route
      params = match.params
      break
    }
  }

  if (!matchedRoute) {
    // 404 fallback
    return <div>Page not found</div>
  }

  // Store params in stack item
  if (currentStackItem && !currentStackItem.params) {
    currentStackItem.params = params
  }

  // Check if we have a cached component for this path
  let component = currentStackItem?.component

  if (!component) {
    // Create new component instance
    const RouteComponent = matchedRoute.component
    component = <RouteComponent {...params} />

    // Cache the component in the stack item
    if (currentStackItem) {
      currentStackItem.component = component
    }
  }

  // Render the component with suspense for lazy loaded routes
  return <Suspense fallback={<LoadingFallback />}>{component}</Suspense>
}
