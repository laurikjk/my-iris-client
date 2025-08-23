/**
 * Minimal geohash implementation for encoding coordinates
 * Based on the geohash algorithm
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision: number = 5
): string {
  let idx = 0
  let bit = 0
  let evenBit = true
  let geohash = ""

  let latMin = -90
  let latMax = 90
  let lonMin = -180
  let lonMax = 180

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude
      const mid = (lonMin + lonMax) / 2
      if (longitude > mid) {
        idx |= 1 << (4 - bit)
        lonMin = mid
      } else {
        lonMax = mid
      }
    } else {
      // latitude
      const mid = (latMin + latMax) / 2
      if (latitude > mid) {
        idx |= 1 << (4 - bit)
        latMin = mid
      } else {
        latMax = mid
      }
    }

    evenBit = !evenBit

    if (bit < 4) {
      bit++
    } else {
      geohash += BASE32[idx]
      bit = 0
      idx = 0
    }
  }

  return geohash
}

export async function getCurrentLocationGeohash(
  precision: number = 5
): Promise<string | null> {
  if (!navigator.geolocation) {
    console.error("Geolocation is not supported by this browser")
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const {latitude, longitude} = position.coords
        const geohash = encodeGeohash(latitude, longitude, precision)
        resolve(geohash)
      },
      (error) => {
        console.error("Error getting location:", error)
        resolve(null)
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  })
}

export function getGeohashPrefixes(geohash: string): string[] {
  const prefixes: string[] = []
  for (let i = 1; i <= geohash.length; i++) {
    prefixes.push(geohash.substring(0, i))
  }
  return prefixes
}
