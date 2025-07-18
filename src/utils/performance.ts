// Simple performance monitoring utility for development
export function logPerformanceMetrics(): void {
  if (process.env.NODE_ENV === "development") {
    // Memory usage
    if ("memory" in performance) {
      const memory = (performance as any).memory as {usedJSHeapSize: number}
      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
        console.log(`Memory usage: ${usedMB} MB`)
      }
    }

    // Component counts
    const components = document.querySelectorAll("[data-component]")
    console.log(`Active components: ${components.length}`)

    // Feed items count
    const feedItems = document.querySelectorAll('[data-testid="feed-item"]')
    console.log(`Feed items rendered: ${feedItems.length}`)
  }
}

// Utility to measure function execution time
export function measureExecutionTime<T>(fn: () => T, label: string): T {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start

  if (process.env.NODE_ENV === "development") {
    console.log(`${label}: ${duration.toFixed(2)}ms`)
  }

  return result
}

// Hook to track component render times
export function usePerformanceTracker(componentName: string): void {
  if (process.env.NODE_ENV === "development") {
    const renderStart = performance.now()

    // Use useEffect to track after render
    setTimeout(() => {
      const renderTime = performance.now() - renderStart
      if (renderTime > 16) {
        // Only log if > 16ms (60fps threshold)
        console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`)
      }
    }, 0)
  }
}
