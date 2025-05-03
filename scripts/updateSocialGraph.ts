import fetch from "node-fetch"
import path from "path"
import fs from "fs"

const TARGET_SIZE = 2 * 1000 * 1000
const SOCIAL_GRAPH_URL = `https://graph-api.iris.to/social-graph?maxBytes=${TARGET_SIZE}`
const PROFILE_DATA_URL = `https://graph-api.iris.to/profile-data?maxBytes=${TARGET_SIZE}&noPictures=true`
const SIZE_TOLERANCE = 0.1 // 10% tolerance
const DATA_DIR = path.resolve(process.cwd(), "node_modules/nostr-social-graph/data")
const SOCIAL_GRAPH_FILE = "socialGraph.json"
const PROFILE_DATA_FILE = "profileData.json"

async function downloadAndValidate(
  url: string,
  targetSize: number
): Promise<string | null> {
  try {
    console.log(`Attempting to download data from ${url}...`)
    const response = await fetch(url)

    if (!response.ok) {
      console.log("Failed to download data:", response.statusText)
      return null
    }

    const data = await response.text()

    // Validate JSON
    try {
      JSON.parse(data)
    } catch (e) {
      console.log("Downloaded data is not valid JSON")
      return null
    }

    // Check size
    const dataSize = Buffer.byteLength(data, "utf8")
    const sizeDiff = Math.abs(dataSize - targetSize) / targetSize

    if (sizeDiff > SIZE_TOLERANCE) {
      console.log(
        `Downloaded data size (${dataSize} bytes) is not within ${SIZE_TOLERANCE * 100}% of target size (${targetSize} bytes)`
      )
      return null
    }

    return data
  } catch (error) {
    console.log("Error downloading data:", error)
    return null
  }
}

async function updateSocialGraph() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true})
    }

    // Download and update social graph
    const socialGraphData = await downloadAndValidate(SOCIAL_GRAPH_URL, TARGET_SIZE)
    if (socialGraphData) {
      const filePath = path.join(DATA_DIR, SOCIAL_GRAPH_FILE)
      fs.writeFileSync(filePath, socialGraphData)
      console.log(
        `Successfully updated social graph data (${Buffer.byteLength(socialGraphData, "utf8")} bytes)`
      )
    }

    // Download and update profile data
    const profileData = await downloadAndValidate(PROFILE_DATA_URL, TARGET_SIZE)
    if (profileData) {
      const filePath = path.join(DATA_DIR, PROFILE_DATA_FILE)
      fs.writeFileSync(filePath, profileData)
      console.log(
        `Successfully updated profile data (${Buffer.byteLength(profileData, "utf8")} bytes)`
      )
    }
  } catch (error) {
    console.log("Error updating data:", error)
  }
}

updateSocialGraph()
