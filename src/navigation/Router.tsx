import {Suspense} from "react"
import {useNavigation} from "./NavigationProvider"
import {routes} from "./routes"
import {matchPath} from "./utils"
import {LoadingFallback} from "@/shared/components/LoadingFallback"

export const Router = () => {
  const {stack, currentIndex} = useNavigation()

  // Render all stack items but only display the current one
  return (
    <>
      {stack.map((item, index) => {
        // Find matching route for this stack item
        let matchedRoute = null
        let params: Record<string, string> = {}

        for (const route of routes) {
          const match = matchPath(item.url, route.path)
          if (match) {
            matchedRoute = route
            params = match.params
            break
          }
        }

        const RouteComponent = matchedRoute?.component

        return (
          <div
            key={`route-${item.index}`} // Stable key based on stack index
            style={{
              display: index === currentIndex ? "block" : "none",
            }}
          >
            <Suspense fallback={<LoadingFallback />}>
              {RouteComponent ? <RouteComponent {...params} /> : <div>Page not found</div>}
            </Suspense>
          </div>
        )
      })}
    </>
  )
}
