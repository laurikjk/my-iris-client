import HomeFeedEvents from "@/pages/home/feed/components/HomeFeedEvents.tsx"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import Widget from "@/shared/components/ui/Widget.tsx"
import {useSettingsStore} from "@/stores/settings"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import {HomeRightColumn} from "@/pages/home/components/HomeRightColumn"

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
    return <HomeRightColumn />
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
              <AlgorithmicFeed
                type="popular"
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
