import {useState, useEffect} from "react"

export function useIsLargeScreen() {
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")

    const handleChange = (e: MediaQueryListEvent) => {
      setIsLargeScreen(e.matches)
    }

    // Set initial value
    setIsLargeScreen(mediaQuery.matches)

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  return isLargeScreen
}
