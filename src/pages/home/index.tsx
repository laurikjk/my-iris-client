import HomeFeed from "@/pages/home/feed/components/HomeFeed.tsx"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {SocialGraphWidget} from "@/shared/components/SocialGraphWidget"
import {RelayStats} from "@/shared/components/RelayStats"
import Widget from "@/shared/components/ui/Widget.tsx"
import {useSettingsStore} from "@/stores/settings"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import {HomeRightColumn} from "@/pages/home/components/HomeRightColumn"

function Index() {
  const {appearance} = useSettingsStore()
  const isLargeScreen = useIsLargeScreen()

  // On mobile, always show HomeFeed regardless of settings
  if (!isLargeScreen) {
    return (
      <section
        className="flex w-full flex-1 relative overflow-y-auto"
        data-main-scroll-container="mobile"
        data-scrollable
      >
        <div className="w-full pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
          <HomeFeed />
        </div>
      </section>
    )
  }

  // When two-column layout is enabled on desktop (singleColumnLayout is false), HomeFeed is shown in Layout
  // So here we just show a placeholder message
  if (!appearance.singleColumnLayout) {
    return <HomeRightColumn />
  }

  // When single column layout is enabled on desktop, show the normal home layout
  return (
    <section
      className="flex w-full justify-center h-full overflow-y-auto"
      data-main-scroll-container="single-column"
      data-scrollable
    >
      <div className="flex-1">
        <HomeFeed />
      </div>
      <RightColumn>
        {() => (
          <>
            <SocialGraphWidget />
            <RelayStats />
            <Widget title="Popular" className="h-96">
              <AlgorithmicFeed
                type="popular"
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
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
