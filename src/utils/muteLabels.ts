import {isTauri} from "./utils"

export const getMuteLabel = (capitalized = true): string => {
  const label = isTauri() ? "block" : "mute"
  return capitalized ? label.charAt(0).toUpperCase() + label.slice(1) : label
}

export const getMutedLabel = (capitalized = true): string => {
  const label = isTauri() ? "blocked" : "muted"
  return capitalized ? label.charAt(0).toUpperCase() + label.slice(1) : label
}

export const getUnmuteLabel = (capitalized = true): string => {
  const label = isTauri() ? "unblock" : "unmute"
  return capitalized ? label.charAt(0).toUpperCase() + label.slice(1) : label
}
