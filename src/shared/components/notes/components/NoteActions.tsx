import EmojiButton from "@/shared/components/emoji/EmojiButton"
import UploadButton, {type UploadState} from "@/shared/components/button/UploadButton"
import {GeohashManager} from "@/shared/components/create/GeohashManager"
import {ExpirationSelector} from "@/shared/components/create/ExpirationSelector"
import {RiAttachment2} from "@remixicon/react"

interface NoteActionsProps {
  onEmojiSelect: (emoji: {native: string}) => void
  onUpload: (
    url: string,
    metadata?: {width: number; height: number; blurhash: string}
  ) => void
  onUploadStateChange: (state: UploadState) => void
  onExpirationChange: (delta: number | null) => void
  onSubmit: () => void
  onClose?: () => void
  draftKey: string
  isModal: boolean
  isReplying: boolean
  canSubmit: boolean
  publishing: boolean
  expirationDelta: number | null
}

export function NoteActions({
  onEmojiSelect,
  onUpload,
  onUploadStateChange,
  onExpirationChange,
  onSubmit,
  onClose,
  draftKey,
  isModal,
  isReplying,
  canSubmit,
  publishing,
  expirationDelta,
}: NoteActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <EmojiButton onEmojiSelect={onEmojiSelect} position="auto" />
        <UploadButton
          onUpload={onUpload}
          multiple={true}
          className="btn btn-ghost btn-circle btn-sm md:btn-md"
          text={<RiAttachment2 className="w-6 h-6" />}
          onStateChange={onUploadStateChange}
        />
        <GeohashManager disabled={publishing} displayInline draftKey={draftKey} />
        <ExpirationSelector
          onExpirationChange={onExpirationChange}
          disabled={publishing}
          currentExpirationDelta={expirationDelta}
        />
      </div>

      <div className="flex items-center gap-2">
        {isModal && onClose && (
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={!canSubmit || publishing}
          className="btn btn-primary btn-sm"
        >
          {(() => {
            if (publishing) return <span className="loading loading-spinner loading-xs" />
            if (isReplying) return "Reply"
            return "Post"
          })()}
        </button>
      </div>
    </div>
  )
}
