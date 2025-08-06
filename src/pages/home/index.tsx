import HomeFeedEvents from "@/pages/home/feed/components/HomeFeedEvents.tsx"
import RightColumn from "@/shared/components/RightColumn.tsx"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import Widget from "@/shared/components/ui/Widget.tsx"
import {useSettingsStore} from "@/stores/settings"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import irisConnectingPeople from "@/assets/iris-connecting-people.png"
import {Link} from "@/navigation"
import SearchBox from "@/shared/components/ui/SearchBox"

function Index() {
  const {appearance} = useSettingsStore()
  const isLargeScreen = useIsLargeScreen()

  // On mobile, always show HomeFeedEvents regardless of settings
  if (!isLargeScreen) {
    return (
      <section className="flex w-full overflow-y-scroll overflow-x-hidden scrollbar-hide flex-1 relative">
        <div className="w-full pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
          <HomeFeedEvents />
        </div>
      </section>
    )
  }

  // When two-column layout is enabled on desktop (singleColumnLayout is false), HomeFeedEvents is shown in Layout
  // So here we just show a placeholder message
  if (!appearance.singleColumnLayout) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="w-full px-4 pt-4 max-w-full">
          <div className="w-full">
            <SearchBox searchNotes={true} className="w-full max-w-full" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Link to="/about">
            <img
              src={irisConnectingPeople}
              alt="Iris — Connecting People"
              className="max-w-md cursor-pointer hover:opacity-90 transition-opacity duration-300 ease-in-out"
            />
          </Link>
        </div>
      </div>
    )
  }

  // When single column layout is enabled on desktop, show the normal home layout
  return (
    <section className="flex w-full justify-center overflow-y-scroll overflow-x-hidden scrollbar-hide h-full">
      <div className="flex-1">
        <HomeFeedEvents />
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular">
              <PopularFeed
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
                  randomSort: true,
                }}
              />
            </Widget>
          </>
        )}
      </RightColumn>
    </section>
  )
}

export default Index
