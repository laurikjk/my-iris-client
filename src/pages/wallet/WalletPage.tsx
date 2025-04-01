import RightColumn from "@/shared/components/RightColumn.tsx"
import Trending from "@/shared/components/feed/Trending.tsx"
import Widget from "@/shared/components/ui/Widget"
import {useNavigate} from "react-router"
import {localState} from "irisdb"
import {useEffect} from "react"

let myPubKey = ""
localState.get("user/publicKey").on((k) => (myPubKey = k as string))
let cashuEnabled = false
localState.get("user/cashuEnabled").on((k) => (cashuEnabled = k as boolean))

export default function WalletPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!cashuEnabled) {
      navigate("/settings/wallet", {replace: true})
    }
  }, [navigate, cashuEnabled])

  if (!cashuEnabled) {
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
