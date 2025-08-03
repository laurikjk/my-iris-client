import RightColumn from "@/shared/components/RightColumn.tsx"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import Widget from "@/shared/components/ui/Widget"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useNavigate} from "react-router"
import {useEffect} from "react"

export default function WalletPage() {
  const navigate = useNavigate()
  const myPubKey = useUserStore((state) => state.publicKey)
  const activeProviderType = useWalletProviderStore((state) => state.activeProviderType)
  const activeNWCId = useWalletProviderStore((state) => state.activeNWCId)
  const nwcConnections = useWalletProviderStore((state) => state.nwcConnections)

  const isLocalCashuWallet =
    activeProviderType === "nwc" &&
    activeNWCId &&
    nwcConnections.find((conn) => conn.id === activeNWCId)?.isLocalCashuWallet

  useEffect(() => {
    if (!isLocalCashuWallet) {
      navigate("/settings/wallet", {replace: true})
    }
  }, [navigate, isLocalCashuWallet])

  if (!isLocalCashuWallet) {
    return null
  }

  return (
    <div className="flex justify-center h-screen">
      <div className="flex-1 overflow-hidden">
        {myPubKey && (
          <div className="w-full h-full">
            <style>{`
              iframe[title="Background Cashu Wallet"] {
                position: absolute !important;
                width: 100% !important;
                height: 100% !important;
                top: 0 !important;
                left: 0 !important;
                z-index: 10 !important;
                pointer-events: auto !important;
              }
            `}</style>
          </div>
        )}
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular">
              <PopularFeed
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
                  randomSort: true,
                }}
              />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}
