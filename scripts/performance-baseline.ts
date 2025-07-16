import {execSync} from "child_process"
import path from "path"
import fs from "fs"

interface PerformanceBaseline {
  feedRenderTime: number
  scrollFrameTime: number
  memoryUsage: number
  timestamp: string
  commit: string
}

async function captureBaseline() {
  try {
    const testOutput = execSync(
      "npx playwright test feed-performance.spec.ts --reporter=json",
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    )

    const results = JSON.parse(testOutput)
    const commit = execSync("git rev-parse HEAD", {encoding: "utf-8"}).trim()

    const baseline: PerformanceBaseline = {
      feedRenderTime: extractMetric(results, "Feed render time"),
      scrollFrameTime: extractMetric(results, "Average frame time"),
      memoryUsage: extractMetric(results, "Memory usage"),
      timestamp: new Date().toISOString(),
      commit,
    }

    const baselinePath = path.join(process.cwd(), "performance-baseline.json")
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2))

    console.log("Performance baseline captured:", baseline)
  } catch (error) {
    console.error("Failed to capture baseline:", error)
  }
}

function extractMetric(results: Record<string, unknown>, metricName: string): number {
  const value = (results as Record<string, unknown>)[metricName]
  return typeof value === "number" ? value : 0
}

captureBaseline().catch(console.error)
