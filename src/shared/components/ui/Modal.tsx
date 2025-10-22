import {ReactNode, useEffect, useRef} from "react"
import {useLocation} from "@/navigation"
import Icon from "../Icons/Icon"

type ModalProps = {
  onClose: () => void
  children: ReactNode
  hasBackground?: boolean
}

const Modal = ({onClose, children, hasBackground = true}: ModalProps) => {
  const modalRef = useRef<HTMLDialogElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const location = useLocation()
  const previousPathname = useRef(location.pathname)

  useEffect(() => {
    // Open modal immediately when component mounts
    const dialog = modalRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  // Close modal when location changes
  useEffect(() => {
    if (previousPathname.current !== location.pathname) {
      previousPathname.current = location.pathname
      onClose()
    }
  }, [location.pathname, onClose])

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        // Only close if no emoji picker is open
        if (!document.querySelector('[data-emoji-picker="true"]')) {
          onClose()
        }
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && e.target === modalRef.current) {
        mouseDownTargetRef.current = e.target
        e.preventDefault()
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (
        mouseDownTargetRef.current === modalRef.current &&
        e.target === modalRef.current
      ) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      mouseDownTargetRef.current = null
    }

    document.addEventListener("keydown", handleEscapeKey)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("keydown", handleEscapeKey)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [onClose])

  return (
    <dialog ref={modalRef} className="modal outline-none">
      <div
        ref={contentRef}
        className={
          hasBackground
            ? "modal-box w-full max-w-full bg-base-100 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] md:pt-4 md:pb-4"
            : "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:pt-0 md:pb-0"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {hasBackground && (
          <button
            className="btn btn-circle btn-ghost absolute z-50 right-2 top-[calc(0.5rem+env(safe-area-inset-top))] md:top-2 focus:outline-none"
            onClick={onClose}
          >
            <Icon name="close" size={12} />
          </button>
        )}
        {children}
      </div>
      {hasBackground && <div className="modal-backdrop" onClick={onClose} />}
    </dialog>
  )
}

export default Modal
