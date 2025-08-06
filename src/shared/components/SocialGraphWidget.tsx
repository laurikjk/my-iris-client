import {useState, useEffect} from "react"
import socialGraph from "@/utils/socialGraph"
import {Link} from "@/navigation"

export function SocialGraphWidget() {
  const [socialGraphSize, setSocialGraphSize] = useState(socialGraph().size())

  useEffect(() => {
    const updateStats = () => {
      setSocialGraphSize(socialGraph().size())
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const distanceData = socialGraphSize.sizeByDistance || {}
  const distance1 = distanceData[1] || 0
  const distance2 = distanceData[2] || 0
  const distance3Plus = Object.entries(distanceData)
    .filter(([d]) => Number(d) >= 3)
    .reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="bg-base-200/50 rounded-lg p-3">
      <Link to="/settings/social-graph" className="inline-block mb-2">
        <h3 className="font-semibold text-sm opacity-80 hover:opacity-100 cursor-pointer transition-opacity underline decoration-dotted underline-offset-2">
          Social Graph
        </h3>
      </Link>
      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
        <div>
          <div className="font-bold text-xl">
            {socialGraphSize.users.toLocaleString()}
          </div>
          <div className="opacity-60">Users</div>
        </div>
        <div>
          <div className="font-bold text-xl">
            {socialGraphSize.follows.toLocaleString()}
          </div>
          <div className="opacity-60">Follows</div>
        </div>
        <div>
          <div className="font-bold text-xl">
            {socialGraphSize.mutes.toLocaleString()}
          </div>
          <div className="opacity-60">Mutes</div>
        </div>
      </div>
      <div className="border-t border-base-300/50 pt-3">
        <div className="text-xs opacity-80 mb-2">Distance from you</div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="font-bold text-lg">{distance1.toLocaleString()}</div>
            <div className="opacity-60">1 hop</div>
          </div>
          <div>
            <div className="font-bold text-lg">{distance2.toLocaleString()}</div>
            <div className="opacity-60">2 hops</div>
          </div>
          <div>
            <div className="font-bold text-lg">{distance3Plus.toLocaleString()}</div>
            <div className="opacity-60">3+ hops</div>
          </div>
        </div>
      </div>
    </div>
  )
}
