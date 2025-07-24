import {MouseEvent, ReactNode, useState, memo, useMemo, useCallback} from "react"
import reactStringReplace from "react-string-replace"

import {Rumor} from "nostr-double-ratchet/src"
import {allEmbeds, smallEmbeds} from "./embed"

const HyperText = memo(
  ({
    children,
    event,
    small,
    truncate,
    expandable = true,
    textPadding = !small,
  }: {
    children: string
    event?: Rumor
    small?: boolean
    truncate?: number
    expandable?: boolean
    textPadding?: boolean
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const content = children.trim()

    const toggleShowMore = useCallback(
      (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        setIsExpanded(!isExpanded)
      },
      [isExpanded]
    )

    const processedChildren = useMemo(() => {
      // Early return if no content
      if (!content) return []

      let result: Array<ReactNode | string> = [content]
      const embeds = small ? smallEmbeds : allEmbeds

      for (const embed of embeds) {
        result = reactStringReplace(result, embed.regex, (match, i) => {
          // Skip processing if match is empty or just whitespace
          if (!match || !match.trim()) {
            return match
          }

          return (
            <embed.component
              match={match}
              index={i}
              event={event}
              key={`${embed.settingsKey || `embed-${embeds.indexOf(embed)}`}-${i}${embed.inline ? "-inline" : ""}`}
            />
          )
        })
      }
      return result
    }, [content, small, event])

    // Handle truncation and expansion
    const finalChildren = useMemo(() => {
      if (!truncate || isExpanded) {
        // If expanded, just add the show less button
        if (isExpanded) {
          return [
            ...processedChildren,
            <span key="show-less">
              {" "}
              <a href="#" onClick={toggleShowMore} className="text-info underline">
                show less
              </a>
            </span>,
          ]
        }
        return processedChildren
      }

      let result = [...processedChildren]
      let isTruncated = false

      // First, find the position of the second media embed
      let mediaEmbedCount = 0
      let secondEmbedIndex = -1

      for (let i = 0; i < result.length; i++) {
        const child = result[i]
        if (child && typeof child === "object" && "key" in child) {
          const isMediaEmbed = child.key && !child.key.includes("-inline")
          if (isMediaEmbed) {
            mediaEmbedCount++
            if (mediaEmbedCount === 2) {
              secondEmbedIndex = i
              break
            }
          }
        }
      }

      // If we found a second media embed, truncate everything from that point
      if (secondEmbedIndex !== -1) {
        result = result.slice(0, secondEmbedIndex)
        isTruncated = true
      } else {
        // No second media embed found, apply text truncation
        let currentCharCount = 0
        let foundTruncationPoint = false

        const truncatedChildren = result.reduce(
          (acc: Array<ReactNode | string>, child) => {
            if (foundTruncationPoint) {
              return acc // Stop processing after truncation
            }

            if (typeof child === "string") {
              if (currentCharCount + child.length > truncate) {
                const remainingChars = truncate - currentCharCount
                if (remainingChars > 0) {
                  let truncatedText = child.substring(0, remainingChars)

                  // Try to break at word boundary to avoid cutting words in half
                  const lastSpaceIndex = truncatedText.lastIndexOf(" ")
                  if (lastSpaceIndex > remainingChars * 0.7) {
                    // Only if we don't lose too much text
                    truncatedText = truncatedText.substring(0, lastSpaceIndex)
                  }

                  // Preserve trailing space if original had it and we're truncating
                  if (
                    truncatedText.trim() &&
                    !truncatedText.endsWith(" ") &&
                    child.charAt(truncatedText.length) === " "
                  ) {
                    truncatedText += " "
                  }

                  if (truncatedText.trim()) {
                    acc.push(truncatedText)
                  }
                }
                foundTruncationPoint = true
                isTruncated = true
                return acc
              }
              currentCharCount += child.length
            } else {
              // For React components, estimate character count (assume ~10 chars for mentions)
              currentCharCount += 10
            }

            acc.push(child)
            return acc
          },
          [] as Array<ReactNode | string>
        )
        result = truncatedChildren
      }

      if (isTruncated && expandable) {
        result.push(
          <span key="show-more">
            ...{" "}
            <a href="#" onClick={toggleShowMore} className="text-info underline">
              show more
            </a>
          </span>
        )
      }

      return result
    }, [processedChildren, truncate, isExpanded, expandable, toggleShowMore])

    // Simplified grouping logic
    const groupedChildren = useMemo(() => {
      if (!textPadding) return finalChildren

      const grouped: ReactNode[] = []
      let currentGroup: ReactNode[] = []
      let groupCounter = 0

      for (const child of finalChildren) {
        const isInline =
          typeof child === "string" ||
          (child &&
            typeof child === "object" &&
            "key" in child &&
            child.key?.includes("-inline"))

        if (isInline) {
          currentGroup.push(child)
        } else {
          if (currentGroup.length > 0) {
            grouped.push(
              <div key={`inline-group-${groupCounter++}`} className="px-4">
                {currentGroup}
              </div>
            )
            currentGroup = []
          }
          grouped.push(child)
        }
      }

      // Add any remaining group
      if (currentGroup.length > 0) {
        grouped.push(
          <div key={`inline-group-${groupCounter++}`} className="px-4">
            {currentGroup}
          </div>
        )
      }

      return grouped
    }, [finalChildren, textPadding])

    // Filter out empty strings more efficiently
    const renderedChildren = useMemo(() => {
      return groupedChildren.map((child, index) => {
        if (child === "" && index > 0) return " "
        return child
      })
    }, [groupedChildren])

    return (
      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {renderedChildren}
      </div>
    )
  }
)

HyperText.displayName = "HyperText"

export default HyperText
