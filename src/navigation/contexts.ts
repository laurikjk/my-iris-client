import {createContext} from "react"
import {NavigationContextType} from "./types"

export const NavigationContext = createContext<NavigationContextType | null>(null)
export const RouteBaseContext = createContext<string>("")
