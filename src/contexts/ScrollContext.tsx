import {ReactNode, RefObject} from "react"
import {ScrollContext} from "./ScrollContextValue"

export const ScrollProvider = ({
  children,
  scrollContainerRef,
}: {
  children: ReactNode
  scrollContainerRef: RefObject<HTMLDivElement | null>
}) => (
  <ScrollContext.Provider value={scrollContainerRef}>{children}</ScrollContext.Provider>
)
