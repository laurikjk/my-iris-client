import {sha256} from "@noble/hashes/sha256"
import animals from "./data/animals.json"
import adjectives from "./data/adjectives.json"

function capitalize(s: string) {
  if (typeof s !== "string") return ""
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * deterministically create adjective + animal names
 */
export default function (seed: string) {
  if (!seed) {
    throw new Error("No seed provided")
  }
  const hash = sha256(seed) // Uint8Array
  const adjective = adjectives[hash[0] % adjectives.length]
  const animal = animals[hash[1] % animals.length]
  return `${capitalize(adjective)} ${capitalize(animal)}`
}