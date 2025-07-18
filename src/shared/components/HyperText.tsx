import {MouseEvent, ReactNode, useState, memo, useMemo, useCallback} from "react"
import reactStringReplace from "react-string-replace"
import {useSettingsStore} from "@/stores/settings"

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
    const settings = useSettingsStore()

    const toggleShowMore = useCallback(
      (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        setIsExpanded(!isExpanded)
      },
      [isExpanded]
    )

    // Memoize the hide setting separately to avoid unnecessary re-renders
    const hideEventsByUnknownUsers = useMemo(() => {
      return settings.content?.hideEventsByUnknownUsers === false
    }, [settings.content?.hideEventsByUnknownUsers])

    const processedChildren = useMemo(() => {
      // Early return if no content
      if (!content) return []

      let result: Array<ReactNode | string> = [content]
      const embeds = small ? smallEmbeds : allEmbeds

      // Process embeds only if we have content and settings allow it
      for (const embed of embeds) {
        if (embed.settingsKey && hideEventsByUnknownUsers) continue

        result = reactStringReplace(result, embed.regex, (match, i) => (
          <embed.component
            match={match}
            index={i}
            event={event}
            key={`${embed.settingsKey}-${i}${embed.inline ? "-inline" : ""}`}
          />
        ))
      }
      return result
    }, [content, small, hideEventsByUnknownUsers, event])

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
      let charCount = 0
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
        const truncatedChildren = result.reduce(
          (acc: Array<ReactNode | string>, child) => {
            if (typeof child === "string") {
              if (charCount + child.length > truncate) {
                acc.push(child.substring(0, truncate - charCount))
                isTruncated = true
                return acc
              }
              charCount += child.length
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
