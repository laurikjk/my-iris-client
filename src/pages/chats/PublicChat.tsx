import PublicChatHeader from "./components/PublicChatHeader"
import ChatContainer from "./components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {shouldSocialHide} from "@/utils/socialGraph"
import {useNavigate, useParams} from "react-router"
import {comparator} from "./utils/messageGrouping"
import {useEffect, useState, useRef} from "react"
import {Session} from "nostr-double-ratchet/src"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import MessageForm from "./MessageForm"
import {localState} from "irisdb/src"
import {MessageType} from "./Message"
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
  const [session] = useState<Session>({} as Session) // Dummy session for public chat
  const initialLoadDoneRef = useRef<boolean>(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [showNoMessages, setShowNoMessages] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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
        <PublicChatHeader channelMetadata={null} channelId={id || ""} />
        <div className="flex flex-col items-center justify-center h-full p-4">
          <p className="text-error mb-4">{error}</p>
          <button className="btn btn-primary" onClick={() => navigate("/chats")}>
            Back to Chats
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
      <PublicChatHeader channelMetadata={channelMetadata} channelId={id || ""} />
      <ChatContainer
        messages={messages}
        session={session}
        sessionId={id || ""}
        onReply={setReplyingTo}
        showAuthor={true}
        isPublicChat={true}
        initialLoadDone={initialLoadDone}
        showNoMessages={showNoMessages}
      />
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
