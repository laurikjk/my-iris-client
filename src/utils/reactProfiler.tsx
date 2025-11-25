import {Profiler, ReactNode} from "react"
import {PROFILING_ENABLED, onRenderCallback} from "./reactProfilerUtils"

/**
 * Props for PerfProfiler component
 */
interface PerfProfilerProps {
  id: string
  children: ReactNode
}

/**
 * Conditional profiler wrapper - only profiles when enabled
 * Uses module-level constant for zero runtime overhead in production.
 *
 * Usage:
 *   <PerfProfiler id="Feed">
 *     <Feed {...props} />
 *   </PerfProfiler>
 */
export function PerfProfiler({id, children}: PerfProfilerProps): ReactNode {
  // PROFILING_ENABLED is a module-level constant resolved at build time
  // In production builds, this entire branch can be eliminated by the bundler
  if (!PROFILING_ENABLED) {
    return children
  }

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  )
}
