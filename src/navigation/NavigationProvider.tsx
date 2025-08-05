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

const MAX_STACK_SIZE = 5
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
        state: existingState.state,
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

        // If we don't have state, try to find existing item by URL
        if (!state || typeof state.index !== "number") {
          // Look for existing item with this URL
          const existingIndex = prevState.stack.findIndex(
            (item) => item.url === newUrl && !item.state
          )

          if (existingIndex !== -1) {
            return {
              ...prevState,
              currentIndex: existingIndex,
            }
          }

          // Create new entry if not found
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

        // Find the item in our stack by index
        const position = prevState.stack.findIndex((item) => item.index === state.index)

        if (position !== -1) {
          // Found in stack - just update current index
          return {
            ...prevState,
            currentIndex: position,
          }
        }

        // Not found by index - try to find by URL for non-stateful routes
        if (!state.state) {
          const urlPosition = prevState.stack.findIndex(
            (item) => item.url === newUrl && !item.state
          )

          if (urlPosition !== -1) {
            // Found by URL, update the index to match browser state
            // Create a new stack array to avoid mutation
            const updatedStack = [...prevState.stack]
            updatedStack[urlPosition] = {
              ...updatedStack[urlPosition],
              index: state.index,
            }
            return {
              stack: updatedStack,
              currentIndex: urlPosition,
            }
          }
        }

        // Not found - create new entry
        const newItem: StackItem = {
          index: state.index,
          url: newUrl,
          component: null,
          state: state.state,
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
            state: options.state,
          }
        }

        window.history.replaceState(
          {index: newStack[currentIndex]?.index || 0, url: path, state: options.state},
          "",
          path
        )

        return {...prevState, stack: newStack}
      })
      return
    }

    setNavState((prevState) => {
      // Save current scroll position before navigating away
      const updatedStack = [...prevState.stack]
      const currentItem = updatedStack[prevState.currentIndex]
      if (currentItem) {
        currentItem.scrollPosition = window.scrollY
      }

      // If state is provided, always create a new stack item (no caching)
      if (options?.state) {
        // Don't remove forward history for stateful navigation
        // This preserves cached components
        const newIndex = ++stackIndexRef.current
        const newStack = updatedStack

        const newItem: StackItem = {
          index: newIndex,
          url: path,
          component: null,
          state: options.state,
        }

        // Insert at current position + 1, keeping any forward history
        newStack.splice(prevState.currentIndex + 1, 0, newItem)

        window.history.pushState(
          {index: newIndex, url: path, state: options.state},
          "",
          path
        )
        currentUrlRef.current = path

        return {
          stack: newStack,
          currentIndex: prevState.currentIndex + 1,
        }
      }

      // For routes without state, use URL as cache key
      const existingIndex = updatedStack.findIndex(
        (item) => item.url === path && !item.state
      )

      if (existingIndex !== -1) {
        // Reuse existing stack item with same URL (and no state)
        const existingItem = updatedStack[existingIndex]

        // Move to this existing item
        window.history.pushState({index: existingItem.index, url: path}, "", path)
        currentUrlRef.current = path

        // Restore scroll position for Link navigation
        // (Browser handles scroll restoration automatically for back/forward)
        if (existingItem.scrollPosition !== undefined && existingItem.scrollPosition > 0) {
          // Use setTimeout as backup to requestAnimationFrame
          requestAnimationFrame(() => {
            window.scrollTo(0, existingItem.scrollPosition)
            // Double-check after a delay in case something interferes
            setTimeout(() => {
              if (window.scrollY !== existingItem.scrollPosition) {
                window.scrollTo(0, existingItem.scrollPosition)
              }
            }, 100)
          })
        }

        return {
          stack: updatedStack,
          currentIndex: existingIndex,
        }
      }

      // No cached item found, create new one
      const newIndex = ++stackIndexRef.current

      // Remove forward history for non-stateful navigation
      const newStack = updatedStack.slice(0, prevState.currentIndex + 1)

      // Add new item with URL as implicit cache key
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
          // Always keep home ("/") in cache
          if (
            newStack[i].component &&
            newStack[i].url !== "/" &&
            shouldCachePage(newStack[i].url)
          ) {
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
  const currentState = stack[currentIndex]?.state
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < stack.length - 1

  // Parse current params from path
  const currentParams = getRouteParams(currentPath)

  const value: NavigationContextType = {
    currentPath,
    currentParams,
    currentState,
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
