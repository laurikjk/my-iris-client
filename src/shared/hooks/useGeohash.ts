import {useState} from "react"
import {getCurrentLocationGeohash} from "@/utils/geohash"

export interface GeohashPrecisions {
  continent: string // 1 char (~5000km)
  country: string // 2 chars (~1250km)
  region: string // 3 chars (~150km)
  district: string // 4 chars (~40km)
  city?: string // 5 chars (~5km)
  neighborhood?: string // 6 chars (~1.2km)
}

export function useGeohash() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getGeohashPrecisions = async (
    maxPrecision: number = 4
  ): Promise<string[] | null> => {
    setLoading(true)
    setError(null)

    try {
      const geohash = await getCurrentLocationGeohash(maxPrecision)
      if (!geohash) {
        setError("Could not get location")
        return null
      }

      // Return array of increasing precision levels
      const precisions: string[] = []
      for (let i = 1; i <= Math.min(geohash.length, maxPrecision); i++) {
        precisions.push(geohash.substring(0, i))
      }

      return precisions
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get location")
      return null
    } finally {
      setLoading(false)
    }
  }

  const getDetailedGeohash = async (
    maxPrecision: number = 6
  ): Promise<GeohashPrecisions | null> => {
    const precisions = await getGeohashPrecisions(maxPrecision)
    if (!precisions) return null

    return {
      continent: precisions[0] || "",
      country: precisions[1] || "",
      region: precisions[2] || "",
      district: precisions[3] || "",
      city: precisions[4],
      neighborhood: precisions[5],
    }
  }

  return {
    getGeohashPrecisions,
    getDetailedGeohash,
    loading,
    error,
  }
}
