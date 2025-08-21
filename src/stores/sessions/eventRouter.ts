import type {MessageType} from "@/pages/chats/message/Message"
import {usePrivateMessagesStore} from "../privateMessages"

// Route events to the appropriate store based on message content and tags
export const routeEventToStore = (
  message: MessageType,
  userPubKey: string,
  ourPubKey: string
) => {
  console.log("=== ROUTE EVENT TO STORE ===")
  const groupLabelTag = message.tags?.find((tag: string[]) => tag[0] === "l")
  const pTag = message.tags?.find((tag: string[]) => tag[0] === "p")
  console.log("Has group tag:", !!groupLabelTag)
  console.log("Has p tag:", !!pTag, pTag?.[1])
  console.log("Message from us:", message.pubkey === ourPubKey)

  let chatId

  if (groupLabelTag && groupLabelTag[1]) {
    // Group message - store by group ID
    chatId = groupLabelTag[1]
    console.log("Routing to group:", chatId)
  } else {
    // Private message - check if it's from us
    if (message.pubkey === ourPubKey) {
      // For our own messages, route by the p tag (who we sent it to)
      chatId = pTag?.[1] || userPubKey
      console.log("Our message, routing to p tag recipient:", chatId)
    } else {
      // For messages from others, route by the sender (userPubKey)
      chatId = userPubKey
      console.log("Their message, routing to sender:", chatId)
    }
  }

  console.log("Final chatId:", chatId)
  usePrivateMessagesStore.getState().upsert(chatId, message)
}
