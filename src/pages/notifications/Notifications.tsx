import NotificationsFeed from "@/shared/components/feed/NotificationsFeed.tsx"
import RightColumn from "@/shared/components/RightColumn"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import Header from "@/shared/components/header/Header"
import Widget from "@/shared/components/ui/Widget"

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
    <section className="flex flex-col h-full">
      <Header title="Notifications" />
      <div className="flex overflow-y-auto overflow-x-hidden flex-1 relative">
        <div className="flex flex-col flex-1 gap-2">
          <NotificationsFeed />
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
      </div>
    </section>
  )
}

export default Notifications
