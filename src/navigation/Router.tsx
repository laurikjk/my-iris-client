import {Suspense} from "react"
import {useNavigation} from "./NavigationProvider"
import {routes} from "./routes"
import {matchPath} from "./utils"
import {LoadingFallback} from "@/shared/components/LoadingFallback"
import {RouteProvider} from "./RouteContext"

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
        
        // Generate a stable key based on the route path pattern, not the actual URL
        // This ensures the same component instance is reused for the same route
        const routeKey = matchedRoute ? `${item.index}-${matchedRoute.path}` : `${item.index}-404`

        return (
          <div
            key={routeKey} // Use route pattern + index as key
            style={{
              display: index === currentIndex ? "block" : "none",
            }}
          >
            <RouteProvider params={params} url={item.url}>
              <Suspense fallback={<LoadingFallback />}>
                {RouteComponent ? (
                  <RouteComponent {...params} />
                ) : (
                  <div>Page not found</div>
                )}
              </Suspense>
            </RouteProvider>
          </div>
        )
      })}
    </>
  )
}
