import {Link} from "@/navigation"
import SearchBox from "@/shared/components/ui/SearchBox"
import {SocialGraphWidget} from "@/shared/components/SocialGraphWidget"
import {RelayStats} from "@/shared/components/RelayStats"
import irisConnectingPeople from "@/assets/iris-connecting-people.png"

export function HomeRightColumn() {
  return (
    <div className="flex flex-1 flex-col w-full h-full px-4 py-4">
      <div className="w-full max-w-full flex-shrink-0 mb-8">
        <SearchBox searchNotes={true} className="w-full max-w-full" />
      </div>
      <div className="flex flex-col gap-4 items-center">
        <Link to="/about" className="inline-block w-full max-w-xs">
          <img
            src={irisConnectingPeople}
            alt="Iris — Connecting People"
            className="w-full cursor-pointer hover:opacity-90 transition-opacity"
          />
        </Link>
        <div className="w-full max-w-xs">
          <SocialGraphWidget />
        </div>
        <div className="w-full max-w-xs">
          <RelayStats />
        </div>
      </div>
    </div>
  )
}
