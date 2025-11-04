// Barrel exports for P2P Nostr functionality
export {getP2PStats, resetP2PStats} from "./p2pStats"
export type {P2PStats} from "./p2pStats"
export {handleIncomingMessage as handleIncomingEvent} from "./p2pMessages"
export {WebRTCTransportPlugin} from "./WebRTCTransportPlugin"
export {setWebRTCPlugin, getWebRTCPlugin} from "./p2pMessages"
