use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NostrRequest {
    Init,
    Subscribe {
        id: String,
        filters: Vec<serde_json::Value>,
        #[serde(rename = "subscribeOpts")]
        subscribe_opts: Option<SubscribeOpts>,
    },
    Unsubscribe {
        id: String,
    },
    Publish {
        id: String,
        event: serde_json::Value,
        #[serde(rename = "publishOpts")]
        publish_opts: Option<PublishOpts>,
    },
    GetRelayStatus {
        id: String,
    },
    AddRelay {
        url: String,
    },
    RemoveRelay {
        url: String,
    },
    ConnectRelay {
        url: String,
    },
    DisconnectRelay {
        url: String,
    },
    ReconnectDisconnected {
        reason: Option<String>,
    },
    GetStats {
        id: String,
    },
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribeOpts {
    pub destinations: Option<Vec<String>>,
    #[serde(rename = "closeOnEose")]
    pub close_on_eose: Option<bool>,
    pub groupable: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishOpts {
    #[serde(rename = "publishTo")]
    pub publish_to: Option<Vec<String>>,
    #[serde(rename = "verifySignature")]
    pub verify_signature: Option<bool>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NostrResponse {
    Ready,
    Event {
        #[serde(rename = "subId")]
        sub_id: String,
        event: serde_json::Value,
        relay: Option<String>,
    },
    Eose {
        #[serde(rename = "subId")]
        sub_id: String,
    },
    Published {
        id: String,
    },
    Error {
        id: Option<String>,
        error: String,
    },
    RelayStatus {
        id: String,
        #[serde(rename = "relayStatuses")]
        relay_statuses: Vec<RelayStatusInfo>,
    },
    Stats {
        id: String,
        stats: LocalDataStats,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayStatusInfo {
    pub url: String,
    pub status: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDataStats {
    pub total_events: usize,
    pub events_by_kind: std::collections::HashMap<u32, usize>,
}
