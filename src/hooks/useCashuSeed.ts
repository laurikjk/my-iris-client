import {useState, useEffect} from "react"

export const useCashuSeed = () => {
  const [seed, setSeed] = useState<string | null>(null)

  useEffect(() => {
    const storedSeed = localStorage.getItem("cashu:seed")
    setSeed(storedSeed)
  }, [])

  return seed
}
