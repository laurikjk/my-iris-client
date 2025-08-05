import {ReactElement, ComponentType} from "react"

export type StackItem = {
  index: number
  url: string
  component: ReactElement | null
  params?: Record<string, string>
  scrollPosition?: number
  state?: unknown // Navigation state passed with navigate()
}

export type NavigationContextType = {
  currentPath: string
  currentParams: Record<string, string>
  currentState: unknown
  stack: StackItem[]
  currentIndex: number
  navigate: (path: string, options?: NavigateOptions) => void
  goBack: () => void
  goForward: () => void
  canGoBack: boolean
  canGoForward: boolean
  replace: (path: string) => void
  clearStack: () => void
}

export type NavigateOptions = {
  replace?: boolean
  state?: unknown
}

export type RouteDefinition = {
  path: string
  component: ComponentType<unknown>
  exact?: boolean
  alwaysKeep?: boolean // Keep this route's component always mounted in memory
}
