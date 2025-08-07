import {createContext} from "react"

type RouteContextType = {
  params: Record<string, string>
  url: string
}

export const RouteContext = createContext<RouteContextType | null>(null)
