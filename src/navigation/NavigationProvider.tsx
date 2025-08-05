import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react"
import {NavigationContextType, StackItem, NavigateOptions} from "./types"
import {getRouteParams} from "./routeMatcher"

const NavigationContext = createContext<NavigationContextType | null>(null)

const MAX_STACK_SIZE = 10
const SKIP_CACHE_PATTERNS = [
  /^\/\w+\/replies\//, // Reply feeds
  /^\/notifications/, // Notifications should always refresh
]

type NavigationState = {
  stack: StackItem[]
  currentIndex: number
}

export const NavigationProvider = ({children}: {children: React.ReactNode}) => {
  const [navState, setNavState] = useState<NavigationState>({
    stack: [],
    currentIndex: -1,
  })
  const stackIndexRef = useRef(0)

  // Initialize with current URL
  useEffect(() => {
    const initialPath = window.location.pathname

    // Check if we already have history state (e.g., from page refresh)
    const existingState = window.history.state

    if (existingState && typeof existingState.index === "number") {
      // We have existing state, use it
      const initialItem: StackItem = {
        index: existingState.index,
        url: initialPath,
        component: null,
      }
      stackIndexRef.current = existingState.index
      setNavState({
        stack: [initialItem],
        currentIndex: 0,
      })
    } else {
      // No existing state, create new
      const initialItem: StackItem = {
        index: 0,
        url: initialPath,
        component: null,
      }
      setNavState({
        stack: [initialItem],
        currentIndex: 0,
      })

      // Replace browser state
      window.history.replaceState({index: 0, url: initialPath}, "", initialPath)
    }
  }, [])

  // Track current URL to detect changes
  const currentUrlRef = useRef(window.location.pathname)

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const newUrl = window.location.pathname
      const state = event.state

      // Update our navigation state to match the browser
      setNavState((prevState) => {
        currentUrlRef.current = newUrl

        // If we don't have state, create a simple entry
        if (!state || typeof state.index !== "number") {
          return {
            stack: [
              {
                index: -1,
                url: newUrl,
                component: null,
              },
            ],
            currentIndex: 0,
          }
        }

        // Find the item in our stack
        const position = prevState.stack.findIndex((item) => item.index === state.index)

        if (position !== -1) {
          // Found in stack - update current index
          return {
            ...prevState,
            currentIndex: position,
          }
        }

        // Not found - create new entry
        const newItem: StackItem = {
          index: state.index,
          url: newUrl,
          component: null,
        }

        // Add to stack maintaining order
        const newStack = [...prevState.stack, newItem]
        newStack.sort((a, b) => a.index - b.index)

        const newPosition = newStack.findIndex((item) => item.index === state.index)

        return {
          stack: newStack,
          currentIndex: newPosition,
        }
      })
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

  const shouldCachePage = (url: string): boolean => {
    return !SKIP_CACHE_PATTERNS.some((pattern) => pattern.test(url))
  }

  const navigate = useCallback((path: string, options?: NavigateOptions) => {
    if (options?.replace) {
      // Handle replace inline
      setNavState((prevState) => {
        const newStack = [...prevState.stack]
        const {currentIndex} = prevState

        if (currentIndex >= 0 && currentIndex < newStack.length) {
          newStack[currentIndex] = {
            ...newStack[currentIndex],
            url: path,
            component: null,
          }
        }

        window.history.replaceState(
          {index: newStack[currentIndex]?.index || 0, url: path},
          "",
          path
        )

        return {...prevState, stack: newStack}
      })
      return
    }

    const newIndex = ++stackIndexRef.current

    setNavState((prevState) => {
      // Remove any forward history
      const newStack = prevState.stack.slice(0, prevState.currentIndex + 1)

      // Add new item
      const newItem: StackItem = {
        index: newIndex,
        url: path,
        component: null,
      }
      newStack.push(newItem)

      // Memory management: remove old cached components
      if (newStack.length > MAX_STACK_SIZE) {
        const itemsToKeep = MAX_STACK_SIZE
        for (let i = 0; i < newStack.length - itemsToKeep; i++) {
          if (newStack[i].component && shouldCachePage(newStack[i].url)) {
            newStack[i].component = null
          }
        }
      }

      window.history.pushState({index: newIndex, url: path}, "", path)
      currentUrlRef.current = path

      return {
        stack: newStack,
        currentIndex: newStack.length - 1,
      }
    })
  }, [])

  const replace = useCallback((path: string) => {
    setNavState((prevState) => {
      const newStack = [...prevState.stack]
      const {currentIndex} = prevState

      if (currentIndex >= 0 && currentIndex < newStack.length) {
        newStack[currentIndex] = {
          ...newStack[currentIndex],
          url: path,
          component: null,
        }

        window.history.replaceState(
          {index: newStack[currentIndex].index, url: path},
          "",
          path
        )
        currentUrlRef.current = path
      }

      return {...prevState, stack: newStack}
    })
  }, [])

  const goBack = useCallback(() => {
    if (navState.currentIndex > 0) {
      window.history.back()
    } else {
      // If at root, navigate to home
      navigate("/")
    }
  }, [navState.currentIndex, navigate])

  const goForward = useCallback(() => {
    if (navState.currentIndex < navState.stack.length - 1) {
      window.history.forward()
    }
  }, [navState.currentIndex, navState.stack.length])

  const clearStack = useCallback(() => {
    setNavState((prevState) => ({
      stack: [prevState.stack[0] || {index: 0, url: "/", component: null}],
      currentIndex: 0,
    }))
    stackIndexRef.current = 0
  }, [])

  const {stack, currentIndex} = navState
  const currentPath = stack[currentIndex]?.url || "/"
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < stack.length - 1

  // Parse current params from path
  const currentParams = getRouteParams(currentPath)

  const value: NavigationContextType = {
    currentPath,
    currentParams,
    stack,
    currentIndex,
    navigate,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    replace,
    clearStack,
  }

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider")
  }
  return context
}
