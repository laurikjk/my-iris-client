import NotificationsFeed from "@/shared/components/feed/NotificationsFeed.tsx"
import RightColumn from "@/shared/components/RightColumn"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {SocialGraphWidget} from "@/shared/components/SocialGraphWidget"
import {RelayStats} from "@/shared/components/RelayStats"
import Header from "@/shared/components/header/Header"
import Widget from "@/shared/components/ui/Widget"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"

import {subscribeToNotifications} from "@/utils/notifications"
import {useEffect} from "react"
let subscribed = false

function Notifications() {
  useEffect(() => {
    if (subscribed) {
      return
    }
    subscribeToNotifications()
    subscribed = true
  })

  return (
    <div className="flex flex-1 relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title="Notifications" />
        <ScrollablePageContainer>
          <NotificationsFeed />
        </ScrollablePageContainer>
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
    </div>
  )
}

export default Notifications
