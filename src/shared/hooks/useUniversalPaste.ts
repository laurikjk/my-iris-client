import {useEffect} from "react"
import {useNavigate} from "@/navigation"
import {handleNostrIdentifier} from "@/utils/handleNostrIdentifier"

const isEditableElement = (element: EventTarget | null): boolean => {
  if (!element || !(element instanceof HTMLElement)) return false

  const tagName = element.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea") return true

  if (element.isContentEditable) return true

  return false
}

export const useUniversalPaste = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      // Skip if pasting into an editable element
      if (isEditableElement(event.target)) return

      const text = event.clipboardData?.getData("text")
      if (!text?.trim()) return

      // Prevent default to avoid any unintended behavior
      event.preventDefault()

      await handleNostrIdentifier({
        input: text,
        navigate,
      })
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [navigate])
}
