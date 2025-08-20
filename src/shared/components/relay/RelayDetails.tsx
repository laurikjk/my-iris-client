import {useEffect, useState} from "react"
import {fetchRelayInformation, type RelayInformation} from "nostr-tools/nip11"
import Widget from "@/shared/components/ui/Widget"

interface ExtendedRelayInformation extends RelayInformation {
  terms_of_service?: string
  privacy_policy?: string
}

interface RelayDetailsProps {
  relayUrl: string
}

function RelayDetails({relayUrl}: RelayDetailsProps) {
  const [relayInfo, setRelayInfo] = useState<ExtendedRelayInformation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!relayUrl) return

    const fetchInfo = async () => {
      setLoading(true)
      setError(null)
      try {
        const info = (await fetchRelayInformation(relayUrl)) as ExtendedRelayInformation
        setRelayInfo(info)
      } catch (err) {
        console.error("Failed to fetch relay information:", err)
        setError("Failed to fetch relay information")
      } finally {
        setLoading(false)
      }
    }

    fetchInfo()
  }, [relayUrl])

  if (!relayUrl) return null
  if (loading) return null
  if (error) return null
  if (!relayInfo) return null

  const formatFee = (amount: number, unit: string) => {
    if (unit === "msats") {
      return `${(amount / 1000).toLocaleString()} sats`
    }
    return `${amount} ${unit}`
  }

  return (
    <Widget title="Relay Information">
      <div className="space-y-4">
        {relayInfo.icon && (
          <div className="flex justify-center">
            <img
              src={relayInfo.icon}
              alt={relayInfo.name || "Relay icon"}
              className="w-24 h-24 rounded-xl object-cover"
            />
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-center">{relayInfo.name || relayUrl}</h2>

          {relayInfo.description && (
            <p className="text-base-content/70 text-center">{relayInfo.description}</p>
          )}
        </div>

        <div className="divider my-4"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {relayInfo.contact && (
            <div>
              <span className="font-semibold">Contact:</span>{" "}
              <span className="text-base-content/70">{relayInfo.contact}</span>
            </div>
          )}

          {relayInfo.software && (
            <div>
              <span className="font-semibold">Software:</span>{" "}
              <span className="text-base-content/70">
                {relayInfo.software}
                {relayInfo.version && ` v${relayInfo.version}`}
              </span>
            </div>
          )}

          {relayInfo.supported_nips && relayInfo.supported_nips.length > 0 && (
            <div className="md:col-span-2">
              <span className="font-semibold">Supported NIPs:</span>{" "}
              <span className="text-base-content/70">
                {relayInfo.supported_nips.sort((a, b) => a - b).join(", ")}
              </span>
            </div>
          )}

          {relayInfo.limitation && (
            <>
              {relayInfo.limitation.payment_required && (
                <div className="md:col-span-2">
                  <span className="badge badge-warning">Payment Required</span>
                </div>
              )}

              {relayInfo.limitation.auth_required && (
                <div className="md:col-span-2">
                  <span className="badge badge-info">Authentication Required</span>
                </div>
              )}

              {relayInfo.limitation.max_message_length && (
                <div>
                  <span className="font-semibold">Max message size:</span>{" "}
                  <span className="text-base-content/70">
                    {(relayInfo.limitation.max_message_length / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}

              {relayInfo.limitation.max_subscriptions && (
                <div>
                  <span className="font-semibold">Max subscriptions:</span>{" "}
                  <span className="text-base-content/70">
                    {relayInfo.limitation.max_subscriptions}
                  </span>
                </div>
              )}
            </>
          )}

          {relayInfo.fees && (
            <div className="md:col-span-2 space-y-2">
              <span className="font-semibold">Fees:</span>
              {relayInfo.fees.admission && relayInfo.fees.admission.length > 0 && (
                <div className="ml-4">
                  <span className="text-base-content/70">Admission: </span>
                  {relayInfo.fees.admission.map((fee, idx) => (
                    <span key={idx} className="text-base-content/70">
                      {formatFee(fee.amount, fee.unit)}
                      {idx < relayInfo.fees!.admission.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              )}
              {relayInfo.payments_url && (
                <div className="ml-4">
                  <a
                    href={relayInfo.payments_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary text-sm"
                  >
                    Payment info →
                  </a>
                </div>
              )}
            </div>
          )}

          {relayInfo.language_tags && relayInfo.language_tags.length > 0 && (
            <div className="md:col-span-2">
              <span className="font-semibold">Languages:</span>{" "}
              <span className="text-base-content/70">
                {relayInfo.language_tags.join(", ")}
              </span>
            </div>
          )}

          {relayInfo.relay_countries && relayInfo.relay_countries.length > 0 && (
            <div className="md:col-span-2">
              <span className="font-semibold">Countries:</span>{" "}
              <span className="text-base-content/70">
                {relayInfo.relay_countries.join(", ")}
              </span>
            </div>
          )}
        </div>

        {(relayInfo.terms_of_service || relayInfo.privacy_policy) && (
          <>
            <div className="divider my-4"></div>
            <div className="flex justify-center gap-4 text-sm">
              {relayInfo.terms_of_service && (
                <a
                  href={relayInfo.terms_of_service}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  Terms of Service
                </a>
              )}
              {relayInfo.privacy_policy && (
                <a
                  href={relayInfo.privacy_policy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  Privacy Policy
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </Widget>
  )
}

export default RelayDetails
