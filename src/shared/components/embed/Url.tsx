import {Link} from "react-router"
import Embed from "./index.ts"

const Url: Embed = {
  regex: /(https?:\/\/[^\s,\\.]+(?:\.[^\s,.]+)*)/g,
  component: ({match}) => {
    try {
      const url = new URL(match)
      const displayText = match.replace(/^https?:\/\//, "").replace(/\/$/, "")

      if (url.hostname === "iris.to") {
        return (
          <Link className="link link-info" to={url.pathname + url.search + url.hash}>
            {displayText}
          </Link>
        )
      }

      return (
        <a className="link link-info" target="_blank" href={match} rel="noreferrer">
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
