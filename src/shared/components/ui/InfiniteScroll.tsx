import {ReactNode, useCallback, useEffect, useRef} from "react"
import {useMainScrollContainer} from "@/contexts/ScrollContext"

type Props = {
  onLoadMore: () => void
  children: ReactNode
}

const InfiniteScroll = ({onLoadMore, children}: Props) => {
  const observerRef = useRef<HTMLDivElement | null>(null)
  const scrollContainer = useMainScrollContainer()

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
    const observerOptions = {
      root: scrollContainer,
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
