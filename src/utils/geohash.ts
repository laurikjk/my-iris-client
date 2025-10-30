/**
 * Minimal geohash implementation for encoding and decoding coordinates
 * Based on the geohash algorithm
 */

export const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

export function decodeGeohash(geohash: string): [number, number, number, number] {
  let evenBit = true
  let latMin = -90
  let latMax = 90
  let lonMin = -180
  let lonMax = 180

  for (const char of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(char)
    if (idx === -1) continue

    for (let i = 4; i >= 0; i--) {
      const bit = (idx >> i) & 1
      if (evenBit) {
        const mid = (lonMin + lonMax) / 2
        if (bit === 1) {
          lonMin = mid
        } else {
          lonMax = mid
        }
      } else {
        const mid = (latMin + latMax) / 2
        if (bit === 1) {
          latMin = mid
        } else {
          latMax = mid
        }
      }
      evenBit = !evenBit
    }
  }

  return [latMin, latMax, lonMin, lonMax]
}

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
