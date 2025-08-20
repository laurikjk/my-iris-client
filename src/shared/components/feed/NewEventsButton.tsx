import {AvatarGroup} from "@/shared/components/user/AvatarGroup.tsx"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {RefObject, useEffect, useState} from "react"
import {createPortal} from "react-dom"

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
  firstFeedItemRef,
}: NewEventsButtonProps) => {
  const [scrollContainer, setScrollContainer] = useState<Element | null>(null)
  const [feedBounds, setFeedBounds] = useState<{left: number; width: number} | null>(null)

  useEffect(() => {
    // Find the scrollable parent container and get feed bounds
    const findScrollContainer = () => {
      const containers = document.querySelectorAll(".overflow-y-auto, .overflow-y-scroll")
      for (const container of containers) {
        if (container.scrollHeight > container.clientHeight) {
          return container
        }
      }
      return null
    }

    const updateBounds = () => {
      const container = findScrollContainer()
      setScrollContainer(container)

      // Get the feed column bounds
      if (container) {
        const rect = container.getBoundingClientRect()
        setFeedBounds({
          left: rect.left,
          width: rect.width,
        })
      }
    }

    updateBounds()
    window.addEventListener("resize", updateBounds)

    return () => window.removeEventListener("resize", updateBounds)
  }, [firstFeedItemRef])

  if (newEventsFiltered.length === 0 || !scrollContainer || !feedBounds) return null

  const button = (
    <div
      className="fixed bottom-20 md:bottom-10 z-30 pb-[env(safe-area-inset-bottom)]"
      style={{
        left: `${feedBounds.left + feedBounds.width / 2}px`,
        transform: "translateX(-50%)",
      }}
    >
      <button
        className="btn btn-info shadow-xl rounded-full flex items-center gap-2 px-4 min-w-max"
        onClick={() => {
          showNewEvents()
          scrollContainer.scrollTo({top: 0, behavior: "instant"})
        }}
      >
        <AvatarGroup pubKeys={Array.from(newEventsFrom).slice(0, 3)} />
        Show {newEventsFiltered.length > 99 ? "99+" : newEventsFiltered.length} new events
      </button>
    </div>
  )

  return createPortal(button, document.body)
}

export default NewEventsButton
