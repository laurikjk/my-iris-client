import {useEffect, useRef, useState} from "react"
import throttle from "lodash/throttle"

const throttledReplaceState = throttle(
  (newState: Record<string, unknown>) => {
    history.replaceState(newState, "")
  },
  1000,
  {leading: true}
)

export default function useHistoryState<T>(initialValue: T, key: string) {
  const currentHistoryState = history.state ? history.state[key] : undefined
  const myInitialValue =
    currentHistoryState === undefined ? initialValue : currentHistoryState
  const [state, setState] = useState(myInitialValue)

  const latestValue = useRef(state)

  useEffect(() => {
    if (state !== latestValue.current) {
      const newHistoryState = {...history.state, [key]: state}
      throttledReplaceState(newHistoryState)
      latestValue.current = state
    }

    return () => {
      throttledReplaceState.cancel()
      if (state !== latestValue.current) {
        const newHistoryState = {...history.state, [key]: state}
        throttledReplaceState(newHistoryState)
      }
    }
  }, [state, key])

  const popStateListener = (event: PopStateEvent) => {
    if (event.state && key in event.state) {
      setState(event.state[key])
    }
  }

  useEffect(() => {
    window.addEventListener("popstate", popStateListener)
    return () => {
      window.removeEventListener("popstate", popStateListener)
    }
  }, [])

  return [state, setState]
}
