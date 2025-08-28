import {Link} from "@/navigation"

import Embed from "./index.ts"

const Hashtag: Embed = {
  regex: /(?<=^|[^/\w.])(#[a-zA-Z0-9_]+)(?=\s|$|[^\w])/g,
  component: ({match}) => {
    return (
      <Link to={`/search/${encodeURIComponent(match)}`} className="link link-info">
        {match}
      </Link>
    )
  },
  inline: true,
}

export default Hashtag
