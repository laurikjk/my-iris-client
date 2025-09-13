import {LOCATION_COORDINATES} from "./locationCoordinates"
import {encodeGeohash, decodeGeohash} from "./geohash"

/**
 * Convert a human-readable location string to coordinates
 * @param location The location string (e.g., "Poland", "United States")
 * @returns The [latitude, longitude] tuple, or null if not found
 */
export function locationToCoordinates(location: string): [number, number] | null {
  if (!location) return null

  // Normalize the location string
  const normalized = location.toLowerCase().trim()

  // Direct lookup
  if (LOCATION_COORDINATES[normalized]) {
    return LOCATION_COORDINATES[normalized]
  }

  // Try to extract country from "City, Country" format
  const parts = normalized.split(/[,\s]+/).filter(Boolean)

  // Try each part individually (useful for "Paris, France" -> finds "france")
  for (const part of parts) {
    if (LOCATION_COORDINATES[part]) {
      return LOCATION_COORDINATES[part]
    }
  }

  // Try combinations for multi-word places
  if (parts.length > 1) {
    // Try first two words (e.g., "united states")
    const firstTwo = parts.slice(0, 2).join(" ")
    if (LOCATION_COORDINATES[firstTwo]) {
      return LOCATION_COORDINATES[firstTwo]
    }

    // Try last two words
    const lastTwo = parts.slice(-2).join(" ")
    if (LOCATION_COORDINATES[lastTwo]) {
      return LOCATION_COORDINATES[lastTwo]
    }

    // Try first three words (e.g., "united arab emirates")
    if (parts.length >= 3) {
      const firstThree = parts.slice(0, 3).join(" ")
      if (LOCATION_COORDINATES[firstThree]) {
        return LOCATION_COORDINATES[firstThree]
      }
    }
  }

  return null
}

/**
 * Get all coordinates from event tags (from both geohash and location tags)
 * Returns coordinates for direct map display
 */
export function getEventCoordinates(
  tags: string[][]
): Array<{coords: [number, number]; source: string}> {
  const results: Array<{coords: [number, number]; source: string}> = []
  const seen = new Set<string>()

  // Get coordinates from location tags
  tags.forEach((tag) => {
    if (tag[0] === "location" && tag[1]) {
      const coords = locationToCoordinates(tag[1])
      if (coords) {
        const key = `${coords[0]},${coords[1]}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({coords, source: tag[1]})
        }
      }
    }
  })

  return results
}

/**
 * Get geohashes from event tags, including converted location tags
 * For compatibility with existing geohash-based code
 */
export function getGeohashesFromEvent(tags: string[][]): string[] {
  const geohashes: string[] = []

  // Get direct geohash tags
  tags.forEach((tag) => {
    if (tag[0] === "g" && tag[1]) {
      geohashes.push(tag[1].toLowerCase())
    }
  })

  // Convert location tags to geohashes (precision 4 for country-level)
  tags.forEach((tag) => {
    if (tag[0] === "location" && tag[1]) {
      const coords = locationToCoordinates(tag[1])
      if (coords && !(coords[0] === 0 && coords[1] === 0)) {
        const geohash = encodeGeohash(coords[0], coords[1], 4)
        geohashes.push(geohash)
      }
    }
  })

  // Return unique geohashes
  return [...new Set(geohashes)]
}

/**
 * Find location names that map to a given geohash
 * @param geohash The geohash to find locations for
 * @returns Array of location names that map to this geohash
 */
export function getLocationsForGeohash(geohash: string): string[] {
  const locations: string[] = []
  const [minLat, maxLat, minLng, maxLng] = decodeGeohash(geohash)

  // Check each location to see if it falls within the geohash bounds
  Object.entries(LOCATION_COORDINATES).forEach(([name, coords]) => {
    const [lat, lng] = coords
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      // Also check if this location would generate the same geohash at the same precision
      const locationGeohash = encodeGeohash(lat, lng, geohash.length)
      if (locationGeohash === geohash) {
        locations.push(name)
      }
    }
  })

  return locations
}
