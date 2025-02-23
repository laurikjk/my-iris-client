import {MouseEvent, ReactNode, useState, memo} from "react"
import reactStringReplace from "react-string-replace"
import {localState, JsonObject} from "irisdb"
import {NDKEvent} from "@nostr-dev-kit/ndk"

import {allEmbeds, smallEmbeds} from "./embed"

let settings: JsonObject = {}
localState.get("settings").on((s) => {
  if (typeof s === "object" && s !== null && !Array.isArray(s)) {
    settings = s
  }
})

const HyperText = memo(
  ({
    children,
    event,
    small,
    truncate,
    expandable = true,
  }: {
    children: string
    event?: NDKEvent
    small?: boolean
    truncate?: number
    expandable?: boolean
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const content = children.trim()

    const toggleShowMore = (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }

    let processedChildren: Array<ReactNode | string> = [content]

    const embeds = small ? smallEmbeds : allEmbeds

    embeds.forEach((embed) => {
      if (settings?.[embed.settingsKey || ""] === false) return
      processedChildren = reactStringReplace(processedChildren, embed.regex, (match, i) =>
        embed.component({
          match,
          index: i,
          event,
          key: `${embed.settingsKey}-${i}${embed.inline ? "-inline" : ""}`,
        })
      )
    })

    let charCount = 0
    if (truncate && !isExpanded) {
      let isTruncated = false
      processedChildren = processedChildren.reduce(
        (acc: Array<ReactNode | string>, child) => {
          if (typeof child === "string") {
            if (typeof child === "string" && charCount + child.length > truncate) {
              acc.push(child.substring(0, truncate - charCount))
              isTruncated = true
              return acc
            } else if (typeof child === "string") {
              charCount += child.length
            }
          }
          acc.push(child)
          return acc
        },
        [] as Array<ReactNode | string>
      )

      if (isTruncated) {
        processedChildren.push(
          <span key="show-more">
            ...{" "}
            {expandable && (
              <a href="#" onClick={toggleShowMore} className="text-info underline">
                show more
              </a>
            )}
          </span>
        )
      }
    }

    if (isExpanded) {
      processedChildren.push(
        <span key="show-less">
          {" "}
          <a href="#" onClick={toggleShowMore} className="text-info underline">
            show less
          </a>
        </span>
      )
    }

    processedChildren = processedChildren.map((x, index) => {
      if (x === "" && index > 0) x = " "
      return x
    })

    // Group consecutive inline elements and strings
    const groupedChildren: ReactNode[] = []
    let currentGroup: ReactNode[] = []

    processedChildren.forEach((child) => {
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
          groupedChildren.push(
            <div key={`group-${groupedChildren.length}`} className="px-4">
              {currentGroup}
            </div>
          )
          currentGroup = []
        }
        groupedChildren.push(child)
      }
    })

    // Add any remaining group
    if (currentGroup.length > 0) {
      groupedChildren.push(
        <div key={`group-${groupedChildren.length}`} className="px-4">
          {currentGroup}
        </div>
      )
    }

    const result = (
      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {groupedChildren}
      </div>
    )

    return result
  }
)

HyperText.displayName = "HyperText"

export default HyperText
