import {RiAddLine, RiAttachment2} from "@remixicon/react"
import UploadButton from "@/shared/components/button/UploadButton"
import type {EncryptionMeta} from "@/types/global"

interface MessageFormActionsMenuProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
  onUpload: (
    url: string,
    metadata?: {width: number; height: number; blurhash: string},
    encryptionMeta?: EncryptionMeta,
    imetaTag?: string[]
  ) => void
  onCashuSend: () => void
  encrypt: boolean
}

export default function MessageFormActionsMenu({
  isOpen,
  onClose,
  onToggle,
  onUpload,
  onCashuSend,
  encrypt,
}: MessageFormActionsMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="btn btn-ghost btn-circle btn-sm md:btn-md"
      >
        <RiAddLine size={20} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-base-200 rounded-lg shadow-lg border border-base-300 z-50 overflow-hidden">
            <UploadButton
              multiple={true}
              onUpload={(url, metadata, encryptionMeta, imetaTag) => {
                onUpload(url, metadata, encryptionMeta, imetaTag)
                onClose()
              }}
              className="w-full btn btn-ghost justify-start rounded-none hover:bg-base-300"
              text={
                <div className="flex items-center gap-2">
                  <RiAttachment2 size={18} />
                  <span>Attachment</span>
                </div>
              }
              encrypt={encrypt}
            />
            <button
              type="button"
              onClick={() => {
                onCashuSend()
                onClose()
              }}
              className="w-full btn btn-ghost justify-start rounded-none hover:bg-base-300"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">₿</span>
                <span>Send ecash</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
