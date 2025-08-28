import {useMemo} from "react"
import {DEFAULT_RELAYS} from "@/utils/ndk"
import {useUserStore} from "@/stores/user"
import {useUIStore} from "@/stores/ui"
import {RelayList} from "@/shared/components/RelayList"

export function Network() {
  const {relayConfigs, setRelayConfigs, ndkOutboxModel, setNdkOutboxModel} =
    useUserStore()
  const {showRelayIndicator, setShowRelayIndicator} = useUIStore()

  const resetDefaults = () => {
    const defaultConfigs = DEFAULT_RELAYS.map((url) => ({url})) // No disabled flag means enabled
    setRelayConfigs(defaultConfigs)
  }

  const hasDefaultRelays = useMemo(() => {
    const enabledUrls = relayConfigs?.filter((c) => !c.disabled).map((c) => c.url) || []
    return (
      enabledUrls.every((url) => DEFAULT_RELAYS.includes(url)) &&
      enabledUrls.length === DEFAULT_RELAYS.length
    )
  }, [relayConfigs])

  return (
    <div>
      <h2 className="text-2xl mb-4">Network</h2>

      {/* Relay Indicator Setting */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showRelayIndicator}
            onChange={(e) => setShowRelayIndicator(e.target.checked)}
            className="checkbox checkbox-primary"
          />
          <span className="text-base font-medium">Show Relay Indicator</span>
        </label>
      </div>

      {/* NDK Outbox Model Setting */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ndkOutboxModel}
            onChange={(e) => setNdkOutboxModel(e.target.checked)}
            className="checkbox checkbox-primary"
          />
          <div>
            <span className="text-base font-medium">Enable Outbox Model</span>
            <p className="text-sm text-base-content/70">
              Connects to other people&apos;s relays for better event sync
            </p>
          </div>
        </label>
      </div>

      <RelayList
        compact={false}
        showDelete={true}
        showAddRelay={true}
        showDiscovered={true}
        className="mt-4"
        maxHeight="max-h-none"
      />
      {!hasDefaultRelays && (
        <div className="mt-4">
          <button className="btn btn-secondary" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  )
}
