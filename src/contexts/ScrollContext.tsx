import {ReactNode, createContext, useContext, RefObject} from "react"

const ScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export const useMainScrollContainer = () => {
  const ref = useContext(ScrollContext)
  return ref?.current || null
}

export const ScrollProvider = ({
  children,
  scrollContainerRef,
}: {
  children: ReactNode
  scrollContainerRef: RefObject<HTMLDivElement | null>
}) => (
  <ScrollContext.Provider value={scrollContainerRef}>{children}</ScrollContext.Provider>
)
