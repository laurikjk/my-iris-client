import {UserRow} from "@/shared/components/user/UserRow"
import {useState, useRef, useEffect} from "react"
import classNames from "classnames"

type MessageReactionsProps = {
  rawReactions: Record<string, string> | undefined
  isUser: boolean
}

const MessageReactions = ({rawReactions, isUser}: MessageReactionsProps) => {
  const [showReactedUsers, setShowReactedUsers] = useState(false)
  const reactionsRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close the emoji user list and ESC key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
        setShowReactedUsers(false)
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showReactedUsers) {
        setShowReactedUsers(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscKey)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [showReactedUsers])

  // Process reactions to group same emojis together
  const processReactions = () => {
    if (!rawReactions || Object.keys(rawReactions).length === 0) return null

    const reactionCounts: Record<string, number> = {}
    const usersByEmoji: Record<string, string[]> = {}

    Object.entries(rawReactions).forEach(([userId, emoji]) => {
      reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1

      if (!usersByEmoji[emoji]) {
        usersByEmoji[emoji] = []
      }
      usersByEmoji[emoji].push(userId)
    })

    return {reactionCounts, usersByEmoji}
  }

  const processed = processReactions()
  const reactionCounts = processed?.reactionCounts || null
  const usersByEmoji = processed?.usersByEmoji || {}

  if (!reactionCounts || Object.keys(reactionCounts).length === 0) {
    return null
  }

  const toggleReactedUsers = () => {
    setShowReactedUsers(!showReactedUsers)
  }

  return (
    <div className="relative" ref={reactionsRef}>
      <div
        className={classNames(
          "flex flex-wrap gap-1 -mt-2",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {Object.entries(reactionCounts).map(([emoji, count]) => (
          <div
            key={emoji}
            className="flex items-center bg-base-100 border border-custom border-base-200 rounded-full px-2 cursor-pointer hover:bg-base-200"
            onClick={toggleReactedUsers}
          >
            <span className="text-md">{emoji}</span>
            {count > 1 && (
              <span className="ml-1 text-base-content/70 text-xs">{count}</span>
            )}
          </div>
        ))}
      </div>

      {/* User list popup showing all reactions */}
      {showReactedUsers && (
        <div className="absolute z-10 mt-1 bg-base-100 shadow-md rounded-md p-2 text-sm w-64 max-h-48 overflow-y-auto flex flex-col">
          {Object.entries(usersByEmoji).map(([emoji, userIds]) => (
            <div key={emoji} className="pb-2 last:border-0 last:mb-0 last:pb-0">
              {userIds.map((userId) => (
                <div key={userId} className="py-1 flex items-center">
                  <span className="text-lg p-2">{emoji}</span>
                  <UserRow avatarWidth={32} pubKey={userId} linkToProfile={false} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MessageReactions
