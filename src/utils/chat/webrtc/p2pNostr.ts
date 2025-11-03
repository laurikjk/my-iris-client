// Barrel exports for P2P Nostr functionality
export {getP2PStats, resetP2PStats} from "./p2pStats"
export type {P2PStats} from "./p2pStats"
export {initializeWebRTCIntegration} from "./p2pIntegration"
export {closeSubscriptionOnPeers} from "./p2pSubscriptions"
export {handleIncomingMessage as handleIncomingEvent} from "./p2pMessages"
