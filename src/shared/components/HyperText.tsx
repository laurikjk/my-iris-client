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

    const processedChildren = useMemo(() => {
      let result: Array<ReactNode | string> = [content]
      const embeds = small ? smallEmbeds : allEmbeds

      embeds.forEach((embed) => {
        if (
          embed.settingsKey &&
          settings.content &&
          settings.content.hideEventsByUnknownUsers === false
        )
          return
        result = reactStringReplace(result, embed.regex, (match, i) => (
          <embed.component
            match={match}
            index={i}
            event={event}
            key={`${embed.settingsKey}-${i}${embed.inline ? "-inline" : ""}`}
          />
        ))
      })
      return result
    }, [content, small, settings.content?.hideEventsByUnknownUsers, event])

    // Handle truncation and expansion
    const finalChildren = useMemo(() => {
      let result = [...processedChildren]
      let charCount = 0

      if (truncate && !isExpanded) {
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
          // No second media embed found, apply text truncation as before
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
      }

      // Add show less button when expanded
      if (isExpanded) {
        result.push(
          <span key="show-less">
            {" "}
            <a href="#" onClick={toggleShowMore} className="text-info underline">
              show less
            </a>
          </span>
        )
      }

      return result.map((x, index) => {
        if (x === "" && index > 0) return " "
        return x
      })
    }, [processedChildren, truncate, isExpanded, expandable, toggleShowMore])

    // Group consecutive inline elements and strings
    const groupedChildren = useMemo(() => {
      const grouped: ReactNode[] = []
      let currentGroup: ReactNode[] = []
      let groupCounter = 0

      finalChildren.forEach((child) => {
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
              <div
                key={`inline-group-${groupCounter++}`}
                className={textPadding ? "px-4" : ""}
              >
                {currentGroup}
              </div>
            )
            currentGroup = []
          }
          grouped.push(child)
        }
      })

      // Add any remaining group
      if (currentGroup.length > 0) {
        grouped.push(
          <div
            key={`inline-group-${groupCounter++}`}
            className={textPadding ? "px-4" : ""}
          >
            {currentGroup}
          </div>
        )
      }

      return grouped
    }, [finalChildren, textPadding])

    return (
      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {groupedChildren}
      </div>
    )
  }
)

HyperText.displayName = "HyperText"

export default HyperText
