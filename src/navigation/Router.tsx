import {Suspense} from "react"
import {useNavigation} from "./hooks"
import {routes} from "./routes"
import {matchPath} from "./utils"
import {LoadingFallback} from "@/shared/components/LoadingFallback"
import {RouteProvider} from "./RouteContext"
import {RouteBaseContext} from "./contexts"
import ErrorBoundary from "@/shared/components/ui/ErrorBoundary"

export const Router = () => {
  const {stack, currentIndex} = useNavigation()

  // Render all stack items but only display the current one
  return (
    <>
      {stack.map((item, index) => {
        // Find matching route for this stack item
        let matchedRoute = null
        let params: Record<string, string> = {}
        let basePath = ""

        for (const route of routes) {
          const match = matchPath(item.url, route.path)
          if (match) {
            matchedRoute = route
            params = match.params
            // If route ends with /*, provide base path for nested routes
            if (route.path.endsWith("/*")) {
              basePath = route.path.slice(0, -2)
            }
            break
          }
        }

        const RouteComponent = matchedRoute?.component

        // Use URL as key for routes without state (for caching)
        // Use index for routes with state (always new instance)
        // Note: We can change to item.index based + optional cache key routing later if needed
        const routeKey = item.state ? `stack-${item.index}` : `url-${item.url}`

        return (
          <div
            key={routeKey} // Use cache key for stable component instances
            style={{
              display: index === currentIndex ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              minHeight: 0, // Important for flex children to not overflow
            }}
          >
            <RouteProvider params={params} url={item.url}>
              <RouteBaseContext.Provider value={basePath}>
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    {RouteComponent ? (
                      <RouteComponent {...params} />
                    ) : (
                      <div>Page not found</div>
                    )}
                  </Suspense>
                </ErrorBoundary>
              </RouteBaseContext.Provider>
            </RouteProvider>
          </div>
        )
      })}
    </>
  )
}
