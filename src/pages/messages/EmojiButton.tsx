import {LoadingFallback} from "@/shared/components/LoadingFallback"
import {lazy, Suspense, useEffect, useRef, useState} from "react"
import {RiEmotionLine} from "@remixicon/react"

const EmojiPicker = lazy(() => import("@emoji-mart/react"))

interface EmojiButtonProps {
  onEmojiSelect: (emoji: string) => void
}

const EmojiButton = ({onEmojiSelect}: EmojiButtonProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiData, setEmojiData] = useState<any>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showEmojiPicker && !emojiData) {
      import("@emoji-mart/data")
        .then((module) => module.default)
        .then((data) => {
          setEmojiData(data)
        })
    }
  }, [showEmojiPicker, emojiData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        event.stopPropagation()
        event.preventDefault()
        setShowEmojiPicker(false)
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showEmojiPicker) {
        setShowEmojiPicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscKey)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [showEmojiPicker])

  return (
    <>
      <button
        type="button"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="btn btn-ghost btn-circle btn-sm md:btn-md left-2"
      >
        <RiEmotionLine className="w-6 w-6" />
      </button>
      {showEmojiPicker && emojiData && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-14 left-0 z-10"
          data-emoji-picker="true"
        >
          <Suspense fallback={<LoadingFallback />}>
            <EmojiPicker
              data={emojiData}
              onEmojiSelect={(emoji: string) => {
                onEmojiSelect(emoji)
              }}
              autoFocus={true}
              searchPosition="sticky"
              previewPosition="none"
              skinTonePosition="none"
              theme="auto"
            />
          </Suspense>
        </div>
      )}
    </>
  )
}

export default EmojiButton
