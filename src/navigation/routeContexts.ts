import {createContext, useContext} from "react"

type RouteContextType = {
  params: Record<string, string>
  url: string
}

export const RouteContext = createContext<RouteContextType | null>(null)

export const useRouteContext = () => {
  const context = useContext(RouteContext)
  if (!context) {
    throw new Error("useRouteContext must be used within RouteProvider")
  }
  return context
}
