import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import { NavigationProvider } from "../NavigationProvider"
import { Router } from "../Router"
import { routes } from "../routes"
import { useState, useEffect, useRef } from "react"

// Mock routes with test components that track mounting
vi.mock("../routes", () => ({
  routes: [
    {
      path: "/",
      component: vi.fn(() => {
        const mountCount = useRef(0)
        const [mounted, setMounted] = useState(false)
        
        useEffect(() => {
          mountCount.current++
          setMounted(true)
          return () => {
            setMounted(false)
          }
        }, [])
        
        return (
          <div>
            <h1>Home Page</h1>
            <div data-testid="home-mount-count">{mountCount.current}</div>
            <div data-testid="home-mounted">{mounted ? "mounted" : "unmounted"}</div>
          </div>
        )
      }),
    },
    {
      path: "/search",
      component: vi.fn(() => {
        const mountCount = useRef(0)
        const [inputValue, setInputValue] = useState("")
        const [mounted, setMounted] = useState(false)
        
        useEffect(() => {
          mountCount.current++
          setMounted(true)
          return () => {
            setMounted(false)
          }
        }, [])
        
        return (
          <div>
            <h1>Search Page</h1>
            <input
              data-testid="search-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search..."
            />
            <div data-testid="search-mount-count">{mountCount.current}</div>
            <div data-testid="search-mounted">{mounted ? "mounted" : "unmounted"}</div>
            <div data-testid="search-input-value">{inputValue}</div>
          </div>
        )
      }),
    },
    {
      path: "/settings",
      component: vi.fn(() => {
        const mountCount = useRef(0)
        const [checkboxChecked, setCheckboxChecked] = useState(false)
        const [mounted, setMounted] = useState(false)
        
        useEffect(() => {
          mountCount.current++
          setMounted(true)
          return () => {
            setMounted(false)
          }
        }, [])
        
        return (
          <div>
            <h1>Settings Page</h1>
            <label>
              <input
                type="checkbox"
                data-testid="settings-checkbox"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
              />
              Enable feature
            </label>
            <div data-testid="settings-mount-count">{mountCount.current}</div>
            <div data-testid="settings-mounted">{mounted ? "mounted" : "unmounted"}</div>
            <div data-testid="settings-checkbox-value">{checkboxChecked ? "checked" : "unchecked"}</div>
          </div>
        )
      }),
    },
  ],
}))

const TestApp = () => (
  <NavigationProvider>
    <Router />
  </NavigationProvider>
)

describe("Component Mounting Tests", () => {
  beforeEach(() => {
    // Reset window location
    window.history.pushState({}, "", "/")
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should not remount components when navigating back and forward", async () => {
    render(<TestApp />)

    // Verify we're on home page
    expect(screen.getByText("Home Page")).toBeInTheDocument()
    expect(screen.getByTestId("home-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("home-mounted")).toHaveTextContent("mounted")

    // Navigate to search page
    window.history.pushState({ index: 1, url: "/search" }, "", "/search")
    window.dispatchEvent(new PopStateEvent("popstate", { state: { index: 1, url: "/search" } }))

    await waitFor(() => {
      expect(screen.getByText("Search Page")).toBeVisible()
    })

    // Search page should be mounted once
    expect(screen.getByTestId("search-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("search-mounted")).toHaveTextContent("mounted")

    // Home page should still be mounted but hidden
    const homeDiv = screen.getByText("Home Page").parentElement
    expect(homeDiv).toHaveStyle({ display: "none" })
    expect(screen.getByTestId("home-mount-count")).toHaveTextContent("1") // Still 1, not remounted
    expect(screen.getByTestId("home-mounted")).toHaveTextContent("mounted")

    // Navigate to settings
    window.history.pushState({ index: 2, url: "/settings" }, "", "/settings")
    window.dispatchEvent(new PopStateEvent("popstate", { state: { index: 2, url: "/settings" } }))

    await waitFor(() => {
      expect(screen.getByText("Settings Page")).toBeVisible()
    })

    // All pages should still be mounted
    expect(screen.getByTestId("home-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("search-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("settings-mount-count")).toHaveTextContent("1")

    // Navigate back to search
    window.history.back()
    await waitFor(() => {
      expect(screen.getByText("Search Page")).toBeVisible()
    })

    // Mount counts should remain the same
    expect(screen.getByTestId("home-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("search-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("settings-mount-count")).toHaveTextContent("1")

    // Navigate back to home
    window.history.back()
    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeVisible()
    })

    // Still no remounting
    expect(screen.getByTestId("home-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("search-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("settings-mount-count")).toHaveTextContent("1")
  })

  it("should preserve input state when navigating away and back", async () => {
    render(<TestApp />)

    // Navigate to search page
    window.history.pushState({ index: 1, url: "/search" }, "", "/search")
    window.dispatchEvent(new PopStateEvent("popstate", { state: { index: 1, url: "/search" } }))

    await waitFor(() => {
      expect(screen.getByText("Search Page")).toBeVisible()
    })

    // Type in search input
    const searchInput = screen.getByTestId("search-input")
    fireEvent.change(searchInput, { target: { value: "test search query" } })

    // Verify input value is set
    expect(searchInput).toHaveValue("test search query")
    expect(screen.getByTestId("search-input-value")).toHaveTextContent("test search query")

    // Navigate to settings
    window.history.pushState({ index: 2, url: "/settings" }, "", "/settings")
    window.dispatchEvent(new PopStateEvent("popstate", { state: { index: 2, url: "/settings" } }))

    await waitFor(() => {
      expect(screen.getByText("Settings Page")).toBeVisible()
    })

    // Check the checkbox
    const checkbox = screen.getByTestId("settings-checkbox")
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(screen.getByTestId("settings-checkbox-value")).toHaveTextContent("checked")

    // Navigate back to search
    window.history.back()
    await waitFor(() => {
      expect(screen.getByText("Search Page")).toBeVisible()
    })

    // Search input should still have the value
    expect(screen.getByTestId("search-input")).toHaveValue("test search query")
    expect(screen.getByTestId("search-input-value")).toHaveTextContent("test search query")

    // Navigate forward to settings
    window.history.forward()
    await waitFor(() => {
      expect(screen.getByText("Settings Page")).toBeVisible()
    })

    // Checkbox should still be checked
    expect(screen.getByTestId("settings-checkbox")).toBeChecked()
    expect(screen.getByTestId("settings-checkbox-value")).toHaveTextContent("checked")

    // Navigate to home
    window.history.go(-2)
    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeVisible()
    })

    // Navigate forward to search
    window.history.forward()
    await waitFor(() => {
      expect(screen.getByText("Search Page")).toBeVisible()
    })

    // Input value should STILL be preserved
    expect(screen.getByTestId("search-input")).toHaveValue("test search query")
    expect(screen.getByTestId("search-input-value")).toHaveTextContent("test search query")
  })

  it("should maintain component instances across multiple navigations", async () => {
    render(<TestApp />)

    // Navigate between pages multiple times
    const navigationSequence = [
      { url: "/search", index: 1, page: "Search Page" },
      { url: "/settings", index: 2, page: "Settings Page" },
      { url: "/", index: 0, page: "Home Page" },
      { url: "/search", index: 1, page: "Search Page" },
      { url: "/settings", index: 2, page: "Settings Page" },
    ]

    for (const nav of navigationSequence) {
      if (nav.index === 0) {
        // Use back navigation for home
        window.history.go(-2)
      } else {
        window.history.pushState({ index: nav.index, url: nav.url }, "", nav.url)
        window.dispatchEvent(new PopStateEvent("popstate", { state: { index: nav.index, url: nav.url } }))
      }

      await waitFor(() => {
        expect(screen.getByText(nav.page)).toBeVisible()
      })
    }

    // All components should have been mounted only once
    expect(screen.getByTestId("home-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("search-mount-count")).toHaveTextContent("1")
    expect(screen.getByTestId("settings-mount-count")).toHaveTextContent("1")

    // All should still be mounted
    expect(screen.getByTestId("home-mounted")).toHaveTextContent("mounted")
    expect(screen.getByTestId("search-mounted")).toHaveTextContent("mounted")
    expect(screen.getByTestId("settings-mounted")).toHaveTextContent("mounted")
  })

  it("should use stable keys for components", async () => {
    const { container } = render(<TestApp />)

    // Get initial home route div
    const homeRouteDiv = container.querySelector('[style*="display: block"]')
    const initialKey = homeRouteDiv?.getAttribute("key")
    expect(initialKey).toBe("route-0")

    // Navigate to search
    window.history.pushState({ index: 1, url: "/search" }, "", "/search")
    window.dispatchEvent(new PopStateEvent("popstate", { state: { index: 1, url: "/search" } }))

    await waitFor(() => {
      expect(screen.getByText("Search Page")).toBeVisible()
    })

    // Check keys are stable and based on index
    const allRouteDivs = container.querySelectorAll('[style*="display"]')
    const keys = Array.from(allRouteDivs).map(div => div.getAttribute("key"))
    expect(keys).toContain("route-0") // Home
    expect(keys).toContain("route-1") // Search

    // Navigate back to home
    window.history.back()
    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeVisible()
    })

    // Home div should have the same key
    const homeRouteDivAfterNav = container.querySelector('[style*="display: block"]')
    expect(homeRouteDivAfterNav?.getAttribute("key")).toBe("route-0")
  })
})