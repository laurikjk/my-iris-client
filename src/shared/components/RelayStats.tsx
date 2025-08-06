import {useState, useEffect} from "react"
import {ndk as getNdk} from "@/utils/ndk"
import {Link} from "@/navigation"
import {useUserStore} from "@/stores/user"
import {RelayList} from "./RelayList"
import Widget from "@/shared/components/ui/Widget"

interface RelayStatsProps {
  background?: boolean
}

export function RelayStats({background = true}: RelayStatsProps = {}) {
  const {relayConfigs} = useUserStore()
  const [ndkRelays, setNdkRelays] = useState(new Map())

  useEffect(() => {
    const updateStats = () => {
      const ndk = getNdk()
      setNdkRelays(new Map(ndk.pool.relays))
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const connectedCount =
    relayConfigs?.filter((config) => {
      const relay =
        ndkRelays.get(config.url) ||
        ndkRelays.get(config.url.replace(/\/$/, "")) ||
        ndkRelays.get(config.url + "/")
      return !config.disabled && relay?.connected
    }).length || 0

  const totalEnabled = relayConfigs?.filter((c) => !c.disabled).length || 0

  return (
    <Widget title={false} background={background}>
      <div className="p-3">
        <Link to="/settings/network" className="inline-block mb-2">
          <h3 className="font-semibold text-sm opacity-80 hover:opacity-100 cursor-pointer transition-opacity underline decoration-dotted underline-offset-2">
            Network ({connectedCount}/{totalEnabled})
          </h3>
        </Link>
        <RelayList
          compact={true}
          showDelete={false}
          showAddRelay={true}
          itemClassName="hover:opacity-100 transition-opacity group"
        />
      </div>
    </Widget>
  )
}
