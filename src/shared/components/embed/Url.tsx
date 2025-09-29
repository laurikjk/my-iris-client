import {Link} from "@/navigation"
import {openExternalLink} from "@/utils/utils"
import Embed from "./index.ts"

const Url: Embed = {
  regex: /(https?:\/\/[^\s,\\.]+(?:\.[^\s,.]+)*)/g,
  component: ({match, truncated}) => {
    try {
      const url = new URL(match)
      let displayText = match.replace(/^https?:\/\//, "").replace(/\/$/, "")

      // Truncate display text if in truncated mode
      if (truncated && displayText.length > 50) {
        displayText = displayText.substring(0, 47) + "..."
      }

      if (url.hostname === "iris.to") {
        return (
          <Link className="link link-info" to={url.pathname + url.search + url.hash}>
            {displayText}
          </Link>
        )
      }

      return (
        <a
          className="link link-info"
          href={match}
          onClick={(e) => {
            e.preventDefault()
            openExternalLink(match)
          }}
        >
          {displayText}
        </a>
      )
    } catch (error) {
      // If URL parsing fails, just return the original text
      return match
    }
  },
  inline: true,
}

export default Url
