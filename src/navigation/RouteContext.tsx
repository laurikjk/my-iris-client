import {createContext, useContext, ReactNode} from "react"

type RouteContextType = {
  params: Record<string, string>
  url: string
}

export const RouteContext = createContext<RouteContextType | null>(null)

export const RouteProvider = ({
  children,
  params,
  url,
}: {
  children: ReactNode
  params: Record<string, string>
  url: string
}) => {
  return <RouteContext.Provider value={{params, url}}>{children}</RouteContext.Provider>
}

export const useRouteContext = () => {
  const context = useContext(RouteContext)
  if (!context) {
    throw new Error("useRouteContext must be used within RouteProvider")
  }
  return context
}
