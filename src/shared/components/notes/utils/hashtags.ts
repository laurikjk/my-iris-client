// Extract hashtags from text content per NIP-24
export const extractHashtags = (text: string): string[] => {
  // Regex to match hashtags while avoiding false positives
  // - Must start with # followed by alphanumeric chars or underscore
  // - Avoid URLs like example.com/#anchor (preceded by / or .)
  // - Avoid inside URLs (preceded by ://)
  // - Must be at word boundary or start of line
  const hashtagRegex = /(?:^|[^/\w.])#([a-zA-Z0-9_]+)(?=\s|$|[^\w])/g
  const hashtags = new Set<string>()
  let match

  while ((match = hashtagRegex.exec(text)) !== null) {
    const hashtag = match[1].toLowerCase()
    // Skip very short or very long hashtags
    if (hashtag.length >= 2 && hashtag.length <= 50) {
      hashtags.add(hashtag)
    }
  }

  return Array.from(hashtags)
}
