import {AvatarGroup} from "@/shared/components/user/AvatarGroup.tsx"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {RefObject} from "react"
import {useSettingsStore} from "@/stores/settings"

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
  const {appearance} = useSettingsStore()
  const isLargeScreen = typeof window !== "undefined" && window.innerWidth >= 1024
  const isColumnLayout = appearance.alwaysShowMainFeed && isLargeScreen

  if (newEventsFiltered.length === 0) return null

  return (
    <div className="absolute bottom-20 md:bottom-10 left-0 right-0 z-30 flex justify-center pb-[env(safe-area-inset-bottom)] pointer-events-none">
      <button
        className="btn btn-info shadow-xl rounded-full pointer-events-auto"
        onClick={() => {
          showNewEvents()

          // For column layout, scroll the container; for regular layout, scroll window
          if (firstFeedItemRef?.current) {
            if (isColumnLayout) {
              // Find the scrollable column container
              const scrollContainer = firstFeedItemRef.current.closest(".overflow-y-auto")
              if (scrollContainer) {
                scrollContainer.scrollTo({top: 0, behavior: "instant"})
              }
            } else {
              // Regular window scroll
              const rect = firstFeedItemRef.current.getBoundingClientRect()
              const scrollTop = window.scrollY + rect.top - 200 // 200px offset above
              window.scrollTo({top: Math.max(0, scrollTop), behavior: "instant"})
            }
          } else {
            // Fallback
            if (isColumnLayout) {
              const scrollContainer = document.querySelector(".overflow-y-auto")
              if (scrollContainer) {
                scrollContainer.scrollTo({top: 0, behavior: "instant"})
              }
            } else {
              window.scrollTo({top: 0, behavior: "instant"})
            }
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
