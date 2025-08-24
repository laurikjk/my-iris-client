import {LoadingFallback} from "@/shared/components/LoadingFallback"
import {lazy, Suspense, useEffect, useRef, useState} from "react"
import {RiEmotionLine} from "@remixicon/react"
import EmojiType from "@/types/emoji"

const EmojiPicker = lazy(() => import("@emoji-mart/react"))

interface EmojiButtonProps {
  onEmojiSelect: (emoji: EmojiType) => void
  position?: "auto" | "top" | "bottom"
}

const EmojiButton = ({onEmojiSelect, position = "auto"}: EmojiButtonProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiData, setEmojiData] = useState<Record<string, unknown> | null>(null)
  const [pickerPosition, setPickerPosition] = useState<"top" | "bottom">("bottom")
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showEmojiPicker && !emojiData) {
      import("@emoji-mart/data")
        .then((module) => module.default)
        .then((data) => {
          setEmojiData(data)
        })
    }
  }, [showEmojiPicker, emojiData])

  // Determine best position for picker
  useEffect(() => {
    if (showEmojiPicker && buttonRef.current && position === "auto") {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - buttonRect.bottom
      const spaceAbove = buttonRect.top
      const pickerHeight = 435 // Approximate height of emoji picker

      // If not enough space below and more space above, show on top
      if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
        setPickerPosition("top")
      } else {
        setPickerPosition("bottom")
      }
    } else if (position !== "auto") {
      setPickerPosition(position)
    }
  }, [showEmojiPicker, position])

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

  const getPickerPositionClasses = () => {
    if (pickerPosition === "top") {
      return "absolute bottom-full mb-2 left-0 z-50"
    }
    return "absolute top-full mt-2 left-0 z-50"
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="btn btn-ghost btn-circle btn-sm md:btn-md"
      >
        <RiEmotionLine className="w-6 h-6" />
      </button>
      {showEmojiPicker && emojiData && (
        <div
          ref={emojiPickerRef}
          className={getPickerPositionClasses()}
          data-emoji-picker="true"
        >
          <Suspense fallback={<LoadingFallback />}>
            <EmojiPicker
              data={emojiData}
              onEmojiSelect={onEmojiSelect}
              autoFocus={true}
              searchPosition="sticky"
              previewPosition="none"
              skinTonePosition="none"
              theme="auto"
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default EmojiButton
