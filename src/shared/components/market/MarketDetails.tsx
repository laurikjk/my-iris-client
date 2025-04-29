import {formatTagValue} from "@/shared/utils/marketUtils"
import {useState} from "react"

type MarketDetailsProps = {
  tags: string[][]
}

/**
 * A reusable component for displaying market listing details
 */
const MarketDetails = ({tags}: MarketDetailsProps) => {
  const [showDetails, setShowDetails] = useState(false)

  if (tags.length === 0) return null

  return (
    <div className="mt-4">
      <button
        className="btn btn-sm btn-outline"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? "Hide Details" : "Show Details"}
      </button>

      {showDetails && (
        <div className="mt-2 p-2 bg-base-200 rounded-lg whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          <ul className="text-xs space-y-1">
            {tags.map((tag, index) => (
              <li key={index} className="flex">
                <span className="font-medium mr-2">{tag[0]}:</span>
                <span>{formatTagValue(tag)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default MarketDetails
