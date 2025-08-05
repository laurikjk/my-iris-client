export {NavigationProvider} from "./NavigationProvider"
export {Router} from "./Router"
export {Link, NavLink} from "./Link"
export {useNavigation, useNavigate, useLocation, useParams} from "./hooks"
export {useRouteContext} from "./routeContexts"
export {Routes, Route, Outlet} from "./RoutesComponent"
export type {
  NavigationContextType,
  StackItem,
  NavigateOptions,
  RouteDefinition,
} from "./types"

// Compatibility exports for react-router
export const useNavigationType = () => "PUSH"
import {ReactNode} from "react"

export const RouterProvider = ({children}: {children: ReactNode}) => children
export const createBrowserRouter = () => null
export const createRoutesFromElements = () => null
