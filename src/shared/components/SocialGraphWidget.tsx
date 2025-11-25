import {useState, useEffect, useCallback} from "react"
import {nip19} from "nostr-tools"
import {useSocialGraph} from "@/utils/socialGraph"
import {Link, useNavigate} from "@/navigation"
import Widget from "@/shared/components/ui/Widget"
import {formatAmount} from "@/utils/utils"

interface SocialGraphWidgetProps {
  background?: boolean
}

export function SocialGraphWidget({background = true}: SocialGraphWidgetProps = {}) {
  const socialGraph = useSocialGraph()
  const [socialGraphSize, setSocialGraphSize] = useState(socialGraph.size())
  const navigate = useNavigate()

  useEffect(() => {
    const updateStats = () => {
      setSocialGraphSize(socialGraph.size())
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [socialGraph])

  const distanceData = socialGraphSize.sizeByDistance || {}
  const distance1 = distanceData[1] || 0
  const distance2 = distanceData[2] || 0
  const distance3Plus = Object.entries(distanceData)
    .filter(([d]) => Number(d) >= 3)
    .reduce((sum, [, count]) => sum + count, 0)

  const pickRandomAtDistance = useCallback(
    (distance: number) => {
      const users = socialGraph.getUsersByFollowDistance(distance)
      if (users && users.size > 0) {
        const userArray = Array.from(users)
        const randomUser = userArray[Math.floor(Math.random() * userArray.length)]
        const npub = nip19.npubEncode(randomUser)
        navigate(`/${npub}`)
      }
    },
    [navigate, socialGraph]
  )

  const pickRandomAtDistance3Plus = useCallback(() => {
    const distances = Object.keys(distanceData)
      .map(Number)
      .filter((d) => d >= 3)

    if (distances.length === 0) return

    const randomDistance = distances[Math.floor(Math.random() * distances.length)]
    pickRandomAtDistance(randomDistance)
  }, [distanceData, pickRandomAtDistance])

  return (
    <Widget title={false} background={background} className="h-auto">
      <div className="p-3">
        <Link to="/settings/social-graph" className="inline-block mb-2">
          <h3 className="font-semibold text-sm opacity-80 hover:opacity-100 cursor-pointer transition-opacity underline decoration-dotted underline-offset-2">
            Social Graph
          </h3>
        </Link>
        <div className="grid grid-cols-3 gap-3 text-xs mb-3">
          <div>
            <div className="font-bold text-xl">
              {formatAmount(socialGraphSize.users, 3)}
            </div>
            <div className="opacity-60">Users</div>
          </div>
          <div>
            <div className="font-bold text-xl">
              {formatAmount(socialGraphSize.follows, 3)}
            </div>
            <div className="opacity-60">Follows</div>
          </div>
          <div>
            <div className="font-bold text-xl">
              {formatAmount(socialGraphSize.mutes, 3)}
            </div>
            <div className="opacity-60">Mutes</div>
          </div>
        </div>
        <div className="border-t border-base-300/50 pt-3">
          <div className="text-xs opacity-80 mb-2">Distance from you</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="font-bold text-lg">{formatAmount(distance1, 3)}</div>
              <div className="opacity-60">1 hop</div>
              {distance1 > 0 && (
                <button
                  onClick={() => pickRandomAtDistance(1)}
                  className="text-[10px] link link-info mt-1"
                >
                  pick random
                </button>
              )}
            </div>
            <div>
              <div className="font-bold text-lg">{formatAmount(distance2, 3)}</div>
              <div className="opacity-60">2 hops</div>
              {distance2 > 0 && (
                <button
                  onClick={() => pickRandomAtDistance(2)}
                  className="text-[10px] link link-info mt-1"
                >
                  pick random
                </button>
              )}
            </div>
            <div>
              <div className="font-bold text-lg">{formatAmount(distance3Plus, 3)}</div>
              <div className="opacity-60">3+ hops</div>
              {distance3Plus > 0 && (
                <button
                  onClick={pickRandomAtDistance3Plus}
                  className="text-[10px] link link-info mt-1"
                >
                  pick random
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Widget>
  )
}
