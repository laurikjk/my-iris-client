import {Rumor} from "nostr-double-ratchet"

export const getLanguageFromFilename = (filename: string) => {
  const basename = filename.split("/").pop()
  const extension = filename.split(".").pop()

  switch (basename) {
    case "go.mod":
    case "go.sum":
      return "ini"
    default:
      break
  }

  switch (extension) {
    case "js":
      return "javascript"
    case "ts":
      return "typescript"
    case "jsx":
      return "javascript" // Monaco uses 'javascript' for JSX as well
    case "tsx":
      return "typescript" // Monaco uses 'typescript' for TSX as well
    case "html":
      return "html"
    case "css":
      return "css"
    case "json":
      return "json"
    case "py":
      return "python"
    case "java":
      return "java"
    case "c":
      return "c"
    case "cpp":
      return "cpp" // Check Monaco's documentation for C++ identifier
    case "cs":
      return "csharp"
    case "rb":
      return "ruby"
    case "go":
      return "go"
    case "php":
      return "php"
    case "md":
      return "markdown"
    case "xml":
      return "xml"
    case "sql":
      return "sql"
    case "yaml":
    case "yml":
      return "yaml"
    case "bat":
      return "bat"
    default:
      return "plaintext"
  }
}

export const formatAmount = (n: number) => {
  if (n < 1000) return n + " "
  if (n < 1000000) return (n / 1000).toFixed(2).replace(".00", "") + "K "
  return (n / 1000000).toFixed(2).replace(".00", "") + "M "
}

export const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} bytes`
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  } else {
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
}

export function uint8ArrayToHexString(uint8Array: Uint8Array): string {
  return Array.from(uint8Array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function getMillisecondTimestamp(event: Rumor) {
  const msTag = event.tags.find((tag) => tag[0] === "ms")
  if (msTag) {
    return parseInt(msTag[1])
  }
  return event.created_at * 1000
}
