import {useEffect, RefObject} from "react"

export function useTextareaAutosize(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  text: string,
  isFocused: boolean,
  expandOnFocus: boolean
) {
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }

  useEffect(() => {
    if (!expandOnFocus || isFocused || text) {
      adjustTextareaHeight()
    }
  }, [text, isFocused, expandOnFocus])

  return {adjustTextareaHeight}
}
