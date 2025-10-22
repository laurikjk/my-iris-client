import {useCashuSeed} from "@/hooks/useCashuSeed"
import {useState} from "react"

export const CashuSeedBackup = () => {
  const seed = useCashuSeed()
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    if (!seed) return

    await navigator.clipboard.writeText(seed)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (!seed) {
    return null
  }

  return (
    <div className="flex flex-col space-y-1">
      <button onClick={handleCopy} className="text-info text-left">
        {isCopied ? "Copied" : "Copy Cashu seed"}
      </button>
      <span className="text-xs text-base-content/60">
        Copy and securely store your Cashu wallet seed. Keep this safe.
      </span>
    </div>
  )
}
