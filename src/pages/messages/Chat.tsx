import {Session, getMillisecondTimestamp} from "nostr-double-ratchet/src"
import ErrorBoundary from "@/shared/components/ui/ErrorBoundary"
import {useEffect, useMemo, useState, useRef} from "react"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import Message, {MessageType} from "./Message"
import MessageForm from "./MessageForm"
import ChatHeader from "./ChatHeader"
import {getSession} from "./Sessions"
import {localState} from "irisdb/src"

const comparator = (a: [string, MessageType], b: [string, MessageType]) =>
  getMillisecondTimestamp(a[1]) - getMillisecondTimestamp(b[1])

const groupingThreshold = 60 * 1000 // 60 seconds = 1 minute

const groupMessages = (
  messages: SortedMap<string, MessageType>,
  timeThreshold: number = groupingThreshold
) => {
  const groups: MessageType[][] = []
  let currentGroup: MessageType[] = []
  let lastDate: string | null = null

  for (const [, message] of messages) {
    const messageDate = new Date(getMillisecondTimestamp(message)).toDateString()
    const hasReply = message.tags?.some((tag) => tag[0] === "e")
    const hasReactions = message.reactions && Object.keys(message.reactions).length > 0

    // If this message is a reply or has reactions, finish the current group
    if (hasReply || hasReactions) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
      }
      // Add this message as its own group
      groups.push([message])
      currentGroup = []
      lastDate = messageDate
      continue
    }

    if (lastDate !== messageDate) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
      }
      currentGroup = [message]
      lastDate = messageDate
    } else {
      if (currentGroup.length === 0) {
        currentGroup.push(message)
      } else {
        const lastMessage = currentGroup[currentGroup.length - 1]
        const timeDiff =
          getMillisecondTimestamp(message) - getMillisecondTimestamp(lastMessage)
        const isSameSender = message.sender === lastMessage.sender

        if (isSameSender && timeDiff <= timeThreshold) {
          currentGroup.push(message)
        } else {
          groups.push(currentGroup)
          currentGroup = [message]
        }
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

const Chat = ({id}: {id: string}) => {
  const [messages, setMessages] = useState(
    new SortedMap<string, MessageType>([], comparator)
  )
  const [session, setSession] = useState<Session | undefined>(undefined)
  const [haveReply, setHaveReply] = useState(false)
  const [haveSent, setHaveSent] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
  }

  useEffect(() => {
    scrollToBottom()
  }, [])

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    } else {
      setShowScrollDown(true)
    }
  }, [messages])

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const {scrollTop, scrollHeight, clientHeight} = chatContainerRef.current
      const isBottom = scrollTop + clientHeight >= scrollHeight - 10
      setIsAtBottom(isBottom)
      setShowScrollDown(!isBottom)
    }
  }

  const messageGroups = useMemo(() => groupMessages(messages), [messages])

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
      <ChatHeader id={id} messages={messages} />
      <div
        ref={chatContainerRef}
        className="flex flex-col justify-end flex-1 overflow-y-auto space-y-4 p-4 relative"
        onScroll={handleScroll}
      >
        {messageGroups.map((group, index) => {
          const groupDate = new Date(getMillisecondTimestamp(group[0])).toDateString()
          const prevGroupDate =
            index > 0
              ? new Date(
                  getMillisecondTimestamp(messageGroups[index - 1][0])
                ).toDateString()
              : null

          return (
            <div key={index} className="mb-6">
              {(!prevGroupDate || groupDate !== prevGroupDate) && (
                <div className="text-xs text-base-content/50 text-center mb-4">
                  {groupDate}
                </div>
              )}
              <div className="flex flex-col gap-[2px]">
                <ErrorBoundary>
                  {group.map((message, messageIndex) => (
                    <Message
                      key={message.id}
                      message={message}
                      isFirst={messageIndex === 0}
                      isLast={messageIndex === group.length - 1}
                      session={session}
                      sessionId={id}
                      onReply={() => setReplyingTo(message)}
                    />
                  ))}
                </ErrorBoundary>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      {showScrollDown && (
        <button
          className="btn btn-circle btn-primary fixed bottom-20 right-4"
          onClick={scrollToBottom}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}
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
