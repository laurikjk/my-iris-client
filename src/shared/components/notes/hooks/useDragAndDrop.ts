import {useState, DragEvent, RefObject} from "react"

interface UseDragAndDropParams {
  containerRef: RefObject<HTMLDivElement | null>
  isModal: boolean
  expandOnFocus: boolean
  isFocused: boolean
  onFocusChange: (focused: boolean) => void
}

export function useDragAndDrop(params: UseDragAndDropParams) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
      if (!params.isModal && params.expandOnFocus && !params.isFocused) {
        params.onFocusChange(true)
      }
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!params.containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const fileInput = params.containerRef.current?.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      if (fileInput) {
        const dt = new DataTransfer()
        files.forEach((file) => dt.items.add(file))
        fileInput.files = dt.files

        const event = new Event("change", {bubbles: true})
        fileInput.dispatchEvent(event)
      }
    }
  }

  return {
    isDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  }
}
