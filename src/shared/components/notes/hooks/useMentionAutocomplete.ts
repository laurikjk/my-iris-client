import {useState, useEffect, useCallback, RefObject, useRef} from "react"
import {nip19} from "nostr-tools"
import {search, SearchResult} from "@/utils/profileSearch"

interface MentionCursorPosition {
  top: number
  left: number
}

export function useMentionAutocomplete(
  text: string,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  containerRef: RefObject<HTMLDivElement | null>
) {
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState<number>(0)
  const [mentionCursorPosition, setMentionCursorPosition] =
    useState<MentionCursorPosition | null>(null)
  const latestSearchRef = useRef(0)

  // Search for profiles
  useEffect(() => {
    if (mentionSearch !== null) {
      const searchId = ++latestSearchRef.current
      search(mentionSearch).then((results) => {
        if (searchId !== latestSearchRef.current) return
        setSearchResults(results.slice(0, 10).map((result) => result.item))
        setSelectedMentionIndex(0)
      })
    } else {
      setSearchResults([])
      setSelectedMentionIndex(0)
    }
  }, [mentionSearch])

  const updateMentionCursorPosition = useCallback(() => {
    if (textareaRef.current && containerRef.current) {
      const textarea = textareaRef.current
      const container = containerRef.current
      const {selectionEnd} = textarea
      const {lineHeight} = getComputedStyle(textarea)
      const lines = textarea.value.substring(0, selectionEnd).split("\n")
      const lineNumber = lines.length - 1

      const containerRect = container.getBoundingClientRect()
      const textareaRect = textarea.getBoundingClientRect()

      setMentionCursorPosition({
        left: 0,
        top:
          textareaRect.top - containerRect.top + parseInt(lineHeight) * (lineNumber + 1),
      })
    }
  }, [textareaRef, containerRef])

  const handleSelectMention = useCallback(
    (result: SearchResult, onTextChange: (text: string) => void) => {
      if (textareaRef.current) {
        const cursorPosition = textareaRef.current.selectionStart
        const mentionRegex = /(?:^|\s)@\S*$/
        const beforeCursor = text.slice(0, cursorPosition)
        const lastMentionStart = beforeCursor.search(mentionRegex)

        if (lastMentionStart !== -1) {
          const mentionText = `nostr:${nip19.npubEncode(result.pubKey)} `
          const newValue =
            text.slice(0, lastMentionStart) +
            (lastMentionStart > 0 ? text[lastMentionStart] : "") +
            mentionText +
            text.slice(cursorPosition)

          onTextChange(newValue)
          setMentionSearch(null)

          const newCursorPosition =
            lastMentionStart + mentionText.length + (lastMentionStart > 0 ? 1 : 0)
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
              textareaRef.current.focus()
            }
          }, 0)
        }
      }
    },
    [text, textareaRef]
  )

  const detectMention = useCallback(
    (cursorPosition: number) => {
      const mentionRegex = /(?:^|\s)@(\S*)$/
      const beforeCursor = text.slice(0, cursorPosition)
      const match = beforeCursor.match(mentionRegex)

      if (match) {
        setMentionSearch(match[1])
        updateMentionCursorPosition()
      } else {
        setMentionSearch(null)
      }
    },
    [text, updateMentionCursorPosition]
  )

  const moveMentionSelection = useCallback(
    (direction: "up" | "down") => {
      if (direction === "down") {
        setSelectedMentionIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        )
      } else {
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        )
      }
    },
    [searchResults.length]
  )

  const clearMention = useCallback(() => {
    setMentionSearch(null)
  }, [])

  return {
    mentionSearch,
    searchResults,
    selectedMentionIndex,
    mentionCursorPosition,
    detectMention,
    handleSelectMention,
    moveMentionSelection,
    clearMention,
  }
}
