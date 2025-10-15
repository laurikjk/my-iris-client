import {
  FormEvent,
  useState,
  useEffect,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react"
import type {EncryptionMeta as BaseEncryptionMeta} from "@/types/global"
import {useAutosizeTextarea} from "@/shared/hooks/useAutosizeTextarea"
import UploadButton from "@/shared/components/button/UploadButton"
import EmojiButton from "@/shared/components/emoji/EmojiButton"
import MessageFormReplyPreview from "./MessageFormReplyPreview"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"
import Icon from "@/shared/components/Icons/Icon"
import {RiAttachment2} from "@remixicon/react"
import EmojiType from "@/types/emoji"
import {MessageType} from "./Message"
import {getSessionManager} from "@/shared/services/PrivateChats"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {useUserStore} from "@/stores/user"

interface MessageFormProps {
  id: string
  replyingTo?: MessageType
  setReplyingTo: (message?: MessageType) => void
  onSendMessage?: (content: string) => Promise<void>
  isPublicChat?: boolean
  groupId?: string
  groupMembers?: string[]
}

// Extend EncryptionMeta locally to allow imetaTag
interface EncryptionMetaWithImeta extends BaseEncryptionMeta {
  imetaTag?: string[]
}

const MessageForm = ({
  id,
  replyingTo,
  setReplyingTo,
  onSendMessage,
  isPublicChat = false,
  groupId,
  groupMembers,
}: MessageFormProps) => {
  const [newMessage, setNewMessage] = useState("")
  const [encryptionMetadata, setEncryptionMetadata] = useState<
    Map<string, EncryptionMetaWithImeta>
  >(new Map())
  const textareaRef = useAutosizeTextarea(newMessage)

  useEffect(() => {
    if (!isTouchDevice && textareaRef.current) {
      textareaRef.current.focus()
    }

    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus()
    }

    const handleEscKey = (event: Event) => {
      const keyboardEvent = event as unknown as ReactKeyboardEvent
      if (keyboardEvent.key === "Escape" && replyingTo) {
        setReplyingTo(undefined)
      }
    }

    document.addEventListener("keydown", handleEscKey)
    return () => document.removeEventListener("keydown", handleEscKey)
  }, [id, isTouchDevice, replyingTo, setReplyingTo])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text) return

    setNewMessage("")
    if (replyingTo) {
      setReplyingTo(undefined)
    }
    if (onSendMessage) {
      onSendMessage(text).catch((error) => {
        console.error("Failed to send message:", error)
      })
      return
    }

    try {
      const sessionManager = getSessionManager()
      if (!sessionManager) {
        console.error("Session manager not available")
        return
      }

      const myPubKey = useUserStore.getState().publicKey
      if (!myPubKey) return

      // Build tags (shared for DMs and groups)
      const extraTags: string[][] = []
      if (replyingTo) {
        extraTags.push(["e", replyingTo.id, "", "reply"])
      }
      // Add imeta tags for encrypted files
      encryptionMetadata.forEach((meta, url) => {
        if (text.includes(url) && meta.imetaTag) {
          extraTags.push(meta.imetaTag)
        }
      })

      // Handle group messages
      if (groupId && groupMembers) {
        const {getEventHash} = await import("nostr-tools")
        const now = Date.now()
        const messageEvent = {
          content: text,
          kind: 0,
          created_at: Math.floor(now / 1000),
          tags: [["l", groupId], ["ms", String(now)], ...extraTags],
          pubkey: myPubKey,
          id: "",
        }
        messageEvent.id = getEventHash(messageEvent)

        await usePrivateMessagesStore.getState().upsert(groupId, myPubKey, messageEvent)

        Promise.all(
          groupMembers.map((memberPubKey) =>
            sessionManager.sendEvent(memberPubKey, messageEvent)
          )
        ).catch(console.error)

        setEncryptionMetadata(new Map())
        return
      }

      // DM messages
      const sentMessage =
        extraTags.length > 0
          ? await sessionManager.sendMessage(id, text, {tags: extraTags})
          : await sessionManager.sendMessage(id, text)

      await usePrivateMessagesStore.getState().upsert(id, myPubKey, sentMessage)
      setEncryptionMetadata(new Map())
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value)
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (isTouchDevice) return

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  const handleEmojiClick = (emoji: EmojiType) => {
    setNewMessage((prev) => prev + emoji.native)
    textareaRef.current?.focus()
  }

  const handleUpload = (
    url: string,
    _metadata?: {width: number; height: number; blurhash: string},
    encryptionMeta?: EncryptionMetaWithImeta,
    imetaTag?: string[]
  ) => {
    setNewMessage((prev) => prev + " " + url)
    if (encryptionMeta) {
      setEncryptionMetadata((prev) =>
        new Map(prev).set(url, {...encryptionMeta, imetaTag})
      )
    }
    textareaRef.current?.focus()
  }

  return (
    <footer className="border-t border-custom fixed md:sticky bottom-0 w-full pb-[env(safe-area-inset-bottom)] bg-base-200">
      {replyingTo && (
        <MessageFormReplyPreview replyingTo={replyingTo} setReplyingTo={setReplyingTo} />
      )}

      <div className="flex gap-2 p-4 relative">
        <UploadButton
          multiple={true}
          onUpload={handleUpload}
          className="btn btn-ghost btn-circle btn-sm md:btn-md"
          text={<RiAttachment2 size={20} />}
          encrypt={!isPublicChat}
        />
        <form onSubmit={handleSubmit} className="flex-1 flex gap-2 items-center">
          <div className="relative flex-1 flex gap-2 items-center">
            {!isTouchDevice && <EmojiButton onEmojiSelect={handleEmojiClick} />}
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message"
              className={`flex-1 textarea leading-tight resize-none py-2.5 min-h-[2.5rem] ${
                newMessage.includes("\n") ? "rounded-lg" : "rounded-full"
              }`}
              aria-label="Message input"
              rows={1}
            />
          </div>
          <button
            type="submit"
            className={`btn btn-primary btn-circle btn-sm md:btn-md ${
              isTouchDevice ? "" : "hidden"
            }`}
            aria-label="Send message"
            disabled={!newMessage.trim()}
          >
            <Icon name="arrow-right" className="-rotate-90" />
          </button>
        </form>
      </div>
    </footer>
  )
}

export default MessageForm
