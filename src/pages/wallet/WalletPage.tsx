import RightColumn from "@/shared/components/RightColumn.tsx"
import Trending from "@/shared/components/feed/Trending.tsx"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import Widget from "@/shared/components/ui/Widget"
import {useNavigate} from "react-router"

export default function WalletPage() {
  const [myPubKey] = useLocalState("user/publicKey", "")
  const [cashuEnabled] = useLocalState("user/cashuEnabled", false)
  const navigate = useNavigate()

  if (!cashuEnabled) {
    navigate("/settings/wallet", {replace: true})
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
            <Widget title="Trending posts">
              <Trending />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}
