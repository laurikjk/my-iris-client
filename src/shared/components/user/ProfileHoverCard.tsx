import ProfileCard from "@/shared/components/user/ProfileCard"
import {RefObject} from "react"

interface ProfileHoverCardProps {
  pubKey: string
  showCard: boolean
  cardRef?: RefObject<HTMLDivElement | null>
}

export const ProfileHoverCard = ({pubKey, showCard, cardRef}: ProfileHoverCardProps) => {
  return (
    <div
      ref={cardRef}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className={`cursor-default z-20 bg-base-100 rounded-2xl fixed md:absolute left-0 top-1/2 -translate-y-1/2 md:top-full md:translate-y-0 mt-2 w-full md:w-96 min-h-32 p-4 transition-all duration-300 ease-in-out ${
        showCard ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {showCard && (
        <ProfileCard pubKey={pubKey} showFollows={true} showHoverCard={false} />
      )}
    </div>
  )
}
