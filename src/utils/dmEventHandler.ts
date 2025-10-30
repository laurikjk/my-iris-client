import {getSessionManager} from "@/shared/services/PrivateChats"
import {useUserStore} from "@/stores/user"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {useGroupsStore} from "@/stores/groups"
import {getTag} from "./tagUtils"
import {KIND_CHANNEL_CREATE} from "./constants"
import {isTauri} from "./utils"

let unsubscribeSessionEvents: (() => void) | null = null

export const cleanupSessionEventListener = () => {
  unsubscribeSessionEvents?.()
}

export const attachSessionEventListener = () => {
  try {
    const sessionManager = getSessionManager()
    if (!sessionManager) {
      console.error("Session manager not available")
      return
    }
    void sessionManager
      .init()
      .then(() => {
        unsubscribeSessionEvents?.()
        unsubscribeSessionEvents = sessionManager.onEvent((event, pubKey) => {
          const {publicKey} = useUserStore.getState()
          if (!publicKey) return

          // Trigger desktop notification for DMs if on desktop
          if (isTauri() && event.pubkey !== publicKey) {
            import("./desktopNotifications").then(({handleDMEvent}) => {
              handleDMEvent(event, pubKey).catch(console.error)
            })
          }

          // Check if it's a group creation event
          const lTag = getTag("l", event.tags)
          if (event.kind === KIND_CHANNEL_CREATE && lTag) {
            try {
              const group = JSON.parse(event.content)
              const {addGroup} = useGroupsStore.getState()
              addGroup(group)
              console.log("Received group creation:", group.name, group.id)
            } catch (e) {
              console.error("Failed to parse group creation event:", e)
            }
            return
          }

          // Check if it's a group message (has l tag but not group creation)
          if (lTag) {
            // Create placeholder group if we don't have metadata yet
            const {groups, addGroup} = useGroupsStore.getState()
            if (!groups[lTag]) {
              const placeholderGroup = {
                id: lTag,
                name: `Group ${lTag.slice(0, 8)}`,
                description: "",
                picture: "",
                members: [publicKey],
                createdAt: Date.now(),
              }
              addGroup(placeholderGroup)
              console.log("Created placeholder group:", lTag)
            }

            // Group message or reaction - store under group ID
            console.log("Received group message for group:", lTag)
            void usePrivateMessagesStore.getState().upsert(lTag, publicKey, event)
            return
          }

          const pTag = getTag("p", event.tags)
          if (!pTag) return

          const from = pubKey === publicKey ? pTag : pubKey
          const to = pubKey === publicKey ? publicKey : pTag

          if (!from || !to) return

          void usePrivateMessagesStore.getState().upsert(from, to, event)
        })
      })
      .catch((error) => {
        console.error(
          "Failed to initialize session manager (possibly corrupt data):",
          error
        )
      })
  } catch (error) {
    console.error("Failed to attach session event listener", error)
  }
}
