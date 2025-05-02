import fetch from "node-fetch"
import path from "path"
import fs from "fs"

const TARGET_SIZE = 2 * 1000 * 1000
const TARGET_URL = `https://graph-api.iris.to/social-graph?maxSize=${TARGET_SIZE}`
const SIZE_TOLERANCE = 0.1 // 10% tolerance
const DATA_DIR = path.resolve(process.cwd(), "node_modules/nostr-social-graph/data")
const SOCIAL_GRAPH_FILE = "socialGraph.json"

async function updateSocialGraph() {
  try {
    console.log("Attempting to download social graph data...")
    const response = await fetch(TARGET_URL)

    if (!response.ok) {
      console.log("Failed to download social graph data:", response.statusText)
      return
    }

    const data = await response.text()

    // Validate JSON
    try {
      JSON.parse(data)
    } catch (e) {
      console.log("Downloaded data is not valid JSON")
      return
    }

    // Check size
    const dataSize = Buffer.byteLength(data, "utf8")
    const sizeDiff = Math.abs(dataSize - TARGET_SIZE) / TARGET_SIZE

    if (sizeDiff > SIZE_TOLERANCE) {
      console.log(
        `Downloaded data size (${dataSize} bytes) is not within ${SIZE_TOLERANCE * 100}% of target size (${TARGET_SIZE} bytes)`
      )
      return
    }

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true})
    }

    // Write the file
    const filePath = path.join(DATA_DIR, SOCIAL_GRAPH_FILE)
    fs.writeFileSync(filePath, data)
    console.log(`Successfully updated social graph data (${dataSize} bytes)`)
  } catch (error) {
    console.log("Error updating social graph data:", error)
  }
}

updateSocialGraph()
