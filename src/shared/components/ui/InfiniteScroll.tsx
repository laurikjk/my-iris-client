import {ReactNode, useCallback, useEffect, useRef} from "react"

function findNearestScrollingParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const computedStyle = getComputedStyle(parent)
    const overflowY = computedStyle.overflowY
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      parent.hasAttribute("data-scrollable")
    ) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

type Props = {
  onLoadMore: () => void
  children: ReactNode
  scrollContainer?: HTMLElement | null
}

const InfiniteScroll = ({onLoadMore, children, scrollContainer}: Props) => {
  const observerRef = useRef<HTMLDivElement | null>(null)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0]
      if (target.isIntersecting) {
        onLoadMore()
      }
    },
    [onLoadMore]
  )

  useEffect(() => {
    // Find scroll container automatically if not provided
    let actualScrollContainer = scrollContainer
    if (!actualScrollContainer && observerRef.current) {
      actualScrollContainer = findNearestScrollingParent(observerRef.current)
    }

    const observerOptions = {
      root: actualScrollContainer,
      rootMargin: "1000px",
      threshold: 1.0,
    }

    const observer = new IntersectionObserver(handleObserver, observerOptions)
    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current)
      }
    }
  }, [handleObserver, scrollContainer])

  return (
    <>
      {children}
      <div ref={observerRef} />
    </>
  )
}

export default InfiniteScroll
