import {Link} from "react-router-dom"

import Embed from "./index.ts"

const Hashtag: Embed = {
  regex: /(#\w+)/g,
  component: ({match, key}) => {
    return (
      <Link
        to={`/search/${encodeURIComponent(match)}`}
        key={key}
        className="link link-info"
      >
        {match}
      </Link>
    )
  },
  inline: true,
}

export default Hashtag
