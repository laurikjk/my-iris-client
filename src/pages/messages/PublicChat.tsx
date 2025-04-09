import {Session, getMillisecondTimestamp} from "nostr-double-ratchet/src"
import MinidenticonImg from "@/shared/components/user/MinidenticonImg"
import ErrorBoundary from "@/shared/components/ui/ErrorBoundary"
import {useEffect, useState, useRef, useMemo} from "react"
import Header from "@/shared/components/header/Header"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {shouldSocialHide} from "@/utils/socialGraph"
import ProxyImg from "@/shared/components/ProxyImg"
import {useNavigate, useParams} from "react-router"
import Message, {MessageType} from "./Message"
import {RiEarthLine} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import MessageForm from "./MessageForm"
import {localState} from "irisdb/src"
import {Helmet} from "react-helmet"
import {ndk} from "@/utils/ndk"

// NIP-28 event kinds
const CHANNEL_CREATE = 40
const CHANNEL_MESSAGE = 42

type ChannelMetadata = {
  name: string
  about: string
  picture: string
  relays: string[]
}

const groupingThreshold = 60 * 1000 // 60 seconds = 1 minute

const comparator = (a: [string, MessageType], b: [string, MessageType]) =>
  getMillisecondTimestamp(a[1]) - getMillisecondTimestamp(b[1])

const groupMessages = (
  messages: SortedMap<string, MessageType>,
  timeThreshold: number = groupingThreshold
) => {
  const groups: MessageType[][] = []
  let currentGroup: MessageType[] = []
  let lastDate: string | null = null

  for (const [, message] of messages) {
    const messageDate = new Date(getMillisecondTimestamp(message)).toDateString()

    // Check if this is a reply to another message (not just a channel message)
    // In public chats, all messages have an "e" tag with the channel ID
    // We need to check if it's a reply to another message in the channel
    const isReply = message.tags?.some((tag) => tag[0] === "e" && tag[3] === "reply")
    const hasReactions = message.reactions && Object.keys(message.reactions).length > 0

    // If this message is a reply or has reactions, finish the current group
    if (isReply || hasReactions) {
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

        // For public chats, we need to handle undefined sender values
        // Messages with the same pubkey should be grouped together
        const isSameSender =
          message.sender === lastMessage.sender ||
          (message.sender === undefined &&
            lastMessage.sender === undefined &&
            message.pubkey === lastMessage.pubkey)

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

let publicKey = ""
localState.get("user/publicKey").on((k) => (publicKey = k as string))

const PublicChat = () => {
  const {id} = useParams<{id: string}>()
  const navigate = useNavigate()
  const [channelMetadata, setChannelMetadata] = useState<ChannelMetadata | null>(null)
  const [messages, setMessages] = useState<SortedMap<string, MessageType>>(
    new SortedMap<string, MessageType>([], comparator)
  )
  const [replyingTo, setReplyingTo] = useState<MessageType>()
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [session] = useState<Session>({} as Session) // Dummy session for public chat
  const initialLoadDoneRef = useRef<boolean>(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [showNoMessages, setShowNoMessages] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const messageGroups = useMemo(() => groupMessages(messages), [messages])

  // Set up timeout to show "No messages yet" after 2 seconds
  useEffect(() => {
    if (messages.size === 0) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set a new timeout
      timeoutRef.current = setTimeout(() => {
        setShowNoMessages(true)
      }, 2000)
    } else {
      // If there are messages, don't show the "No messages yet" message
      setShowNoMessages(false)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [messages.size])

  // Fetch channel metadata
  useEffect(() => {
    if (!id) return

    const fetchChannelMetadata = async () => {
      try {
        // Fetch channel creation event (kind 40)
        const channelEvent = await ndk().fetchEvent({
          kinds: [CHANNEL_CREATE],
          ids: [id],
        })

        if (channelEvent) {
          try {
            const metadata = JSON.parse(channelEvent.content)
            setChannelMetadata(metadata)
          } catch (e) {
            console.error("Failed to parse channel creation content:", e)
          }
        }
      } catch (err) {
        console.error("Error fetching channel metadata:", err)
        setError("Failed to load channel metadata")
      }
    }

    fetchChannelMetadata()
  }, [id])

  // Set up continuous subscription for messages
  useEffect(() => {
    if (!id) return

    // Set up subscription for channel messages
    const sub = ndk().subscribe({
      kinds: [CHANNEL_MESSAGE],
      "#e": [id],
    })

    // Handle new messages
    sub.on("event", (event) => {
      if (!event || !event.id) return
      if (shouldSocialHide(event.pubkey)) return

      const newMessage: MessageType = {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        kind: CHANNEL_MESSAGE,
        sender: event.pubkey === publicKey ? "user" : undefined,
        reactions: {},
      }

      setMessages((prev) => {
        // Check if message already exists
        if (prev.has(newMessage.id)) {
          return prev
        }

        // Add new message to SortedMap
        const updated = new SortedMap(prev, comparator)
        updated.set(newMessage.id, newMessage)
        return updated
      })

      // Mark initial load as done after first message
      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true
        setInitialLoadDone(true)
      }
    })

    // Clean up subscription when component unmounts
    return () => {
      sub.stop()
    }
  }, [id])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    } else {
      setShowScrollDown(true)
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
  }

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const {scrollTop, scrollHeight, clientHeight} = chatContainerRef.current
      const isBottom = scrollTop + clientHeight >= scrollHeight - 10
      setIsAtBottom(isBottom)
      setShowScrollDown(!isBottom)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !id) return

    try {
      if (!publicKey) {
        setError("You need to be logged in to send messages")
        return
      }

      // Create channel message event (kind 42)
      const event = new NDKEvent(ndk())
      event.kind = CHANNEL_MESSAGE
      event.content = content

      // Add channel tag
      const tags = [["e", id, "", "root"]]

      // Add reply tag if replying to a message
      if (replyingTo) {
        tags.push(["e", replyingTo.id, "", "reply"])
      }

      event.tags = tags

      // Sign and publish the event
      await event.sign()
      await event.publish()

      // Add message to local state
      const newMessage: MessageType = {
        id: event.id,
        pubkey: publicKey,
        content: content,
        created_at: Math.floor(Date.now() / 1000),
        tags: event.tags,
        kind: CHANNEL_MESSAGE,
        sender: "user",
        reactions: {},
      }

      setMessages((prev) => {
        const updated = new SortedMap(prev, comparator)
        updated.set(newMessage.id, newMessage)
        return updated
      })

      // Clear reply state after sending
      setReplyingTo(undefined)
    } catch (err) {
      console.error("Error sending message:", err)
      setError("Failed to send message")
    }
  }

  if (error) {
    return (
      <>
        <Helmet>
          <title>Error</title>
        </Helmet>
        <Header title="Error" />
        <div className="flex flex-col items-center justify-center h-full p-4">
          <p className="text-error mb-4">{error}</p>
          <button className="btn btn-primary" onClick={() => navigate("/messages")}>
            Back to Messages
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>{channelMetadata?.name || "Public Chat"}</title>
      </Helmet>
      <Header>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            {channelMetadata?.picture ? (
              <ProxyImg
                width={16}
                square={true}
                src={channelMetadata.picture}
                alt="Group Icon"
                className="rounded-full"
              />
            ) : (
              <MinidenticonImg username={id || "unknown"} />
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="font-medium flex items-center gap-1">
              {channelMetadata?.name || "Public Chat"}
            </span>
            <span className="text-xs text-base-content/50 flex items-center gap-1">
              <RiEarthLine className="w-4 h-4" /> Public chat
            </span>
          </div>
        </div>
      </Header>
      <div
        ref={chatContainerRef}
        className="flex flex-col justify-end flex-1 overflow-y-auto space-y-4 p-4 relative"
        onScroll={handleScroll}
      >
        {messages.size === 0 ? (
          <div className="text-center text-base-content/70 my-8">
            {initialLoadDone && showNoMessages
              ? "No messages yet. Be the first to send a message!"
              : ""}
          </div>
        ) : (
          messageGroups.map((group, index) => {
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
                        sessionId={id || ""}
                        onReply={() => setReplyingTo(message)}
                        showAuthor={true}
                      />
                    ))}
                  </ErrorBoundary>
                </div>
              </div>
            )
          })
        )}
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
      {publicKey && (
        <MessageForm
          session={session}
          id={id || ""}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          onSendMessage={handleSendMessage}
        />
      )}
    </>
  )
}

export default PublicChat
