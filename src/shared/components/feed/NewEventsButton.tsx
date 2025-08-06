import {AvatarGroup} from "@/shared/components/user/AvatarGroup.tsx"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {RefObject, useEffect, useState, useRef} from "react"

interface NewEventsButtonProps {
  newEventsFiltered: NDKEvent[]
  newEventsFrom: Set<string>
  showNewEvents: () => void
  firstFeedItemRef: RefObject<HTMLDivElement | null>
}

const NewEventsButton = ({
  newEventsFiltered,
  newEventsFrom,
  showNewEvents,
}: NewEventsButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [columnBounds, setColumnBounds] = useState<{left: number; width: number} | null>(
    null
  )

  useEffect(() => {
    // Find the scrollable parent column
    const findScrollableParent = () => {
      let element = buttonRef.current?.parentElement
      while (element) {
        const style = window.getComputedStyle(element)
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight
        ) {
          return element
        }
        element = element.parentElement
      }
      return null
    }

    const updatePosition = () => {
      const scrollableParent = findScrollableParent()
      if (scrollableParent) {
        const rect = scrollableParent.getBoundingClientRect()
        setColumnBounds({
          left: rect.left,
          width: rect.width,
        })
      }
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [])

  if (newEventsFiltered.length === 0) return null

  const buttonStyle = columnBounds
    ? {
        left: `${columnBounds.left + columnBounds.width / 2}px`,
        transform: "translateX(-50%)",
        visibility: "visible" as const,
      }
    : {
        visibility: "hidden" as const,
      }

  return (
    <div
      ref={buttonRef}
      className="fixed bottom-20 md:bottom-10 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none"
      style={buttonStyle}
    >
      <button
        className="btn btn-info shadow-xl rounded-full pointer-events-auto flex items-center gap-2 px-4 min-w-max"
        onClick={() => {
          showNewEvents()

          // Find and scroll the container
          const scrollContainer = buttonRef.current?.closest(".overflow-y-scroll")
          if (scrollContainer) {
            scrollContainer.scrollTo({top: 0, behavior: "instant"})
          }
        }}
      >
        <AvatarGroup pubKeys={Array.from(newEventsFrom).slice(0, 3)} />
        Show {newEventsFiltered.length > 99 ? "99+" : newEventsFiltered.length} new events
      </button>
    </div>
  )
}

export default NewEventsButton
