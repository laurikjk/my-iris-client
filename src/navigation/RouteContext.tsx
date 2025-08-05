import {ReactNode} from "react"
import {RouteContext} from "./routeContexts"

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
