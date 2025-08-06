import HomeFeedEvents from "@/pages/home/feed/components/HomeFeedEvents.tsx"
import RightColumn from "@/shared/components/RightColumn.tsx"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import Widget from "@/shared/components/ui/Widget.tsx"
import {useSettingsStore} from "@/stores/settings"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import irisConnectingPeople from "@/assets/iris-connecting-people.png"

function Index() {
  const {appearance} = useSettingsStore()
  const isLargeScreen = useIsLargeScreen()

  // On mobile, always show HomeFeedEvents regardless of settings
  if (!isLargeScreen) {
    return (
      <section className="flex flex-1 w-full justify-center">
        <div className="flex-1">
          <HomeFeedEvents />
        </div>
      </section>
    )
  }

  // When alwaysShowMainFeed is enabled on desktop, HomeFeedEvents is shown in Layout
  // So here we just show a placeholder message
  if (appearance.alwaysShowMainFeed) {
    return (
      <div className="flex items-center justify-center h-screen">
        <img
          src={irisConnectingPeople}
          alt="Iris — Connecting People"
          className="max-w-md"
        />
      </div>
    )
  }

  // When alwaysShowMainFeed is disabled on desktop, show the normal home layout
  return (
    <section className="flex flex-1 w-full justify-center">
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
