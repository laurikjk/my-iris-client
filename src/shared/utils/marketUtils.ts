import {NDKEvent} from "@nostr-dev-kit/ndk"

/**
 * Extracts market listing data from an NDKEvent
 */
export const extractMarketData = (event: NDKEvent) => {
  const title = event?.tagValue("title")
  const priceTag = event?.tags?.find((tag) => tag[0] === "price")
  const price = priceTag ? `${priceTag[1]} ${priceTag[2] || ""}` : null
  const imageTag = event?.tags?.find((tag) => tag[0] === "image")
  const imageUrl = imageTag ? imageTag[1] : null
  const summary = event?.tagValue("summary") || event?.content || ""
  const cleanSummary = imageUrl ? summary.replace(imageUrl, "").trim() : summary

  return {
    title,
    price,
    imageUrl,
    summary: cleanSummary,
    content: event?.content || "",
    tags: event?.tags?.filter((tag) => tag[0] !== "title") || [],
  }
}

/**
 * Gets all image URLs from a market listing
 */
export const getMarketImageUrls = (event: NDKEvent) => {
  if (!isMarketListing(event)) return []
  return event.tags.filter((tag) => tag[0] === "image").map((tag) => tag[1])
}

/**
 * Formats a tag value for display
 */
export const formatTagValue = (tag: string[]) => {
  if (tag[0] === "price") {
    return `${tag[1]} ${tag[2] || ""}`
  }
  return tag[1]
}

/**
 * Checks if an event is a market listing
 */
export const isMarketListing = (event: NDKEvent) => {
  return event.kind === 30402
}
