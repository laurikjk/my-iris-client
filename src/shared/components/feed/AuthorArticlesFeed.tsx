import {memo, useState, useEffect} from "react"
import EventBorderless from "@/shared/components/event/EventBorderless"
import {KIND_LONG_FORM_CONTENT} from "@/utils/constants"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"

interface AuthorArticlesFeedProps {
  authorPubkey: string
  currentArticleId?: string
  maxItems?: number
}

const AuthorArticlesFeed = memo(function AuthorArticlesFeed({
  authorPubkey,
  currentArticleId,
  maxItems = 5,
}: AuthorArticlesFeedProps) {
  const [events, setEvents] = useState<NDKEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setEvents([])

    const subscription = ndk().subscribe({
      kinds: [KIND_LONG_FORM_CONTENT],
      authors: [authorPubkey],
      limit: maxItems + 1, // Get extra in case current article is included
    })

    subscription.on("event", (event: NDKEvent) => {
      setEvents((prev) => {
        // Avoid duplicates and filter out current article
        if (event.id === currentArticleId || prev.some((e) => e.id === event.id)) {
          return prev
        }
        return [...prev, event].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      })
    })

    subscription.on("eose", () => {
      setLoading(false)
    })

    return () => {
      subscription.stop()
    }
  }, [authorPubkey, currentArticleId, maxItems])

  const displayEvents = events.slice(0, maxItems)

  if (loading && events.length === 0) {
    return (
      <div className="px-4 py-2 text-base-content/50 text-sm">
        Loading other articles...
      </div>
    )
  }

  if (displayEvents.length === 0) {
    return (
      <div className="px-4 py-2 text-base-content/50 text-sm">
        No other articles from this author
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {displayEvents.map((event) => (
        <EventBorderless key={event.id} event={event} />
      ))}
    </div>
  )
})

export default AuthorArticlesFeed
