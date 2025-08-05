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

export const NavigationProvider = ({children}: {children: React.ReactNode}) => {
  const [stack, setStack] = useState<StackItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const stackIndexRef = useRef(0)
  const isNavigatingRef = useRef(false)

  // Initialize with current URL
  useEffect(() => {
    const initialPath = window.location.pathname
    const initialItem: StackItem = {
      index: 0,
      url: initialPath,
      component: null,
    }
    setStack([initialItem])
    setCurrentIndex(0)

    // Replace browser state
    window.history.replaceState({index: 0, url: initialPath}, "", initialPath)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isNavigatingRef.current) {
        isNavigatingRef.current = false
        return
      }

      const state = event.state
      if (!state || typeof state.index !== "number") return

      const targetIndex = state.index

      setStack((prevStack) => {
        const newStack = prevStack.filter((item) => item.index <= targetIndex)
        setCurrentIndex(newStack.length - 1)
        return newStack
      })
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const shouldCachePage = (url: string): boolean => {
    return !SKIP_CACHE_PATTERNS.some((pattern) => pattern.test(url))
  }

  const navigate = useCallback(
    (path: string, options?: NavigateOptions) => {
      if (options?.replace) {
        // Handle replace inline
        isNavigatingRef.current = true

        setStack((prevStack) => {
          const newStack = [...prevStack]
          if (currentIndex >= 0 && currentIndex < newStack.length) {
            newStack[currentIndex] = {
              ...newStack[currentIndex],
              url: path,
              component: null,
            }
          }
          return newStack
        })

        window.history.replaceState(
          {index: stack[currentIndex]?.index || 0, url: path},
          "",
          path
        )
        return
      }

      isNavigatingRef.current = true
      const newIndex = ++stackIndexRef.current

      setStack((prevStack) => {
        // Remove any forward history
        const newStack = prevStack.slice(0, currentIndex + 1)

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

        setCurrentIndex(newStack.length - 1)
        return newStack
      })

      window.history.pushState({index: newIndex, url: path}, "", path)
    },
    [currentIndex, stack]
  )

  const replace = useCallback(
    (path: string) => {
      isNavigatingRef.current = true

      setStack((prevStack) => {
        const newStack = [...prevStack]
        if (currentIndex >= 0 && currentIndex < newStack.length) {
          newStack[currentIndex] = {
            ...newStack[currentIndex],
            url: path,
            component: null,
          }
        }
        return newStack
      })

      window.history.replaceState(
        {index: stack[currentIndex]?.index || 0, url: path},
        "",
        path
      )
    },
    [currentIndex, stack]
  )

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      window.history.back()
    } else {
      // If at root, navigate to home
      navigate("/")
    }
  }, [currentIndex, navigate])

  const goForward = useCallback(() => {
    if (currentIndex < stack.length - 1) {
      window.history.forward()
    }
  }, [currentIndex, stack.length])

  const clearStack = useCallback(() => {
    setStack((prevStack) => [prevStack[0] || {index: 0, url: "/", component: null}])
    setCurrentIndex(0)
    stackIndexRef.current = 0
  }, [])

  const currentPath = stack[currentIndex]?.url || "/"
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < stack.length - 1
  
  // Parse current params from path
  const currentParams = getRouteParams(currentPath)

  const value: NavigationContextType = {
    currentPath,
    currentParams,
    stack,
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
