import PrivateChatHeader from "./components/PrivateChatHeader"
import ChatContainer from "./components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "./utils/messageGrouping"
import {Session} from "nostr-double-ratchet/src"
import {useEffect, useState} from "react"
import MessageForm from "./MessageForm"
import {getSession} from "./Sessions"
import {localState} from "irisdb/src"
import {MessageType} from "./Message"

const Chat = ({id}: {id: string}) => {
  const [messages, setMessages] = useState(
    new SortedMap<string, MessageType>([], comparator)
  )
  const [session, setSession] = useState<Session | undefined>(undefined)
  const [haveReply, setHaveReply] = useState(false)
  const [haveSent, setHaveSent] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  useEffect(() => {
    const fetchSession = async () => {
      if (id) {
        const fetchedSession = await getSession(id)
        setSession(fetchedSession)
      }
    }

    fetchSession()
  }, [id])

  useEffect(() => {
    if (!(id && session)) {
      return
    }
    setMessages(new SortedMap<string, MessageType>([], comparator))
    const unsub1 = localState
      .get("sessions")
      .get(id)
      .get("events")
      .forEach((event, path) => {
        const split = path.split("/")
        const id = split[split.length - 1]
        if (event && typeof event === "object" && event !== null) {
          if (!haveReply && (event as MessageType).sender !== "user") {
            setHaveReply(true)
          }
          if (!haveSent && (event as MessageType).sender === "user") {
            setHaveSent(true)
          }
          setMessages((prev) => {
            if (prev.has(id)) {
              return prev
            }
            const newMessages = new SortedMap(prev, comparator)
            newMessages.set(id as string, event as MessageType)
            return newMessages
          })
        }
      }, 2)

    return () => {
      unsub1()
    }
  }, [session])

  useEffect(() => {
    if (!id) return
    localState.get("sessions").get(id).get("lastSeen").put(Date.now())

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        localState.get("sessions").get(id).get("lastSeen").put(Date.now())
      }
    }

    const handleFocus = () => {
      localState.get("sessions").get(id).get("lastSeen").put(Date.now())
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [id])

  if (!id || !session) {
    return null
  }

  return (
    <>
      <PrivateChatHeader id={id} messages={messages} />
      <ChatContainer
        messages={messages}
        session={session}
        sessionId={id}
        onReply={setReplyingTo}
      />
      <MessageForm
        session={session}
        id={id}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
      />
    </>
  )
}

export default Chat
