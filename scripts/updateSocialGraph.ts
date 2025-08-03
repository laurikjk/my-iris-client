import fetch from "node-fetch"
import path from "path"
import fs from "fs"

const MAX_EDGES = 300_000
const MAX_EDGES_PER_NODE = 1000
const SOCIAL_GRAPH_URL = `https://graph-api.iris.to/social-graph?maxEdges=${MAX_EDGES}&maxEdgesPerNode=${MAX_EDGES_PER_NODE}`
const SIZE_TOLERANCE = 1
const DATA_DIR = path.resolve(process.cwd(), "node_modules/nostr-social-graph/data")
const SOCIAL_GRAPH_FILE = "socialGraph.bin"
//const PROFILE_DATA_FILE = "profileData.json"
//const PROFILE_DATA_URL = `https://graph-api.iris.to/profile-data?maxBytes=${PROFILES_TARGET_SIZE}&noPictures=true`
//const PROFILES_TARGET_SIZE = 2 * 1000 * 1000

async function downloadAndValidate(
  url: string,
  targetSize?: number,
  isBinary = false
): Promise<string | Buffer | null> {
  try {
    console.log(`Attempting to download data from ${url}...`)
    const response = await fetch(url)

    if (!response.ok) {
      console.log("Failed to download data:", response.statusText)
      return null
    }

    let data: string | Buffer
    let dataSize: number

    if (isBinary) {
      const arrayBuffer = await response.arrayBuffer()
      data = Buffer.from(arrayBuffer)
      dataSize = data.length
    } else {
      data = await response.text()

      // Validate JSON for non-binary data
      try {
        JSON.parse(data)
      } catch (e) {
        console.log("Downloaded data is not valid JSON")
        return null
      }

      dataSize = Buffer.byteLength(data, "utf8")
    }

    // Check size only if targetSize is provided and it's not binary
    if (targetSize && !isBinary) {
      const sizeDiff = Math.abs(dataSize - targetSize) / targetSize

      if (sizeDiff > SIZE_TOLERANCE) {
        console.log(
          `Downloaded data size (${dataSize} bytes) is not within ${SIZE_TOLERANCE * 100}% of target size (${targetSize} bytes)`
        )
        return null
      }
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

    // Download and update social graph (binary)
    const socialGraphData = await downloadAndValidate(SOCIAL_GRAPH_URL, undefined, true)
    if (socialGraphData) {
      const filePath = path.join(DATA_DIR, SOCIAL_GRAPH_FILE)
      fs.writeFileSync(filePath, socialGraphData)
      console.log(
        `Successfully updated social graph data (${socialGraphData instanceof Buffer ? socialGraphData.length : Buffer.byteLength(socialGraphData, "utf8")} bytes)`
      )
    }

    // Download and update profile data (JSON)
    /* disabled for now, existing dataset is better
    const profileData = await downloadAndValidate(
      PROFILE_DATA_URL,
      PROFILES_TARGET_SIZE,
      false
    )
    if (profileData) {
      const filePath = path.join(DATA_DIR, PROFILE_DATA_FILE)
      fs.writeFileSync(filePath, profileData)
      console.log(
        `Successfully updated profile data (${profileData instanceof Buffer ? profileData.length : Buffer.byteLength(profileData, "utf8")} bytes)`
      )
    }
    */
  } catch (error) {
    console.log("Error updating data:", error)
  }
}

updateSocialGraph()
