import {Link} from "react-router"

import Embed from "./index.ts"

const Hashtag: Embed = {
  regex: /(#\w+)/g,
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
