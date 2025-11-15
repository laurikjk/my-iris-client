use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::mpsc::Receiver;
use nostrdb::{Ndb, Config, Filter, Subscription};
use enostr::{RelayPool, ewebsock, ClientMessage};
use tauri::Emitter;
use tracing::{debug, info, warn, error};
use crate::nostr_types::{NostrRequest, NostrResponse, RelayStatusInfo};
use crate::filter_parser::parse_filter;

thread_local! {
    static NDB: RefCell<Option<Ndb>> = RefCell::new(None);
    static POOL: RefCell<Option<RelayPool>> = RefCell::new(None);
    static SUBSCRIPTIONS: RefCell<HashMap<String, Subscription>> = RefCell::new(HashMap::new());
    static SUB_ID_MAP: RefCell<HashMap<u64, String>> = RefCell::new(HashMap::new());
}

pub fn nostr_thread(rx: &Receiver<NostrRequest>, db_path: &str, app_handle: tauri::AppHandle) {
    info!(target: "iris", "Initializing nostrdb and relay pool");
    let config = Config::new();
    let ndb = Ndb::new(&db_path, &config).expect("failed to initialize nostrdb");
    let pool = RelayPool::new();

    NDB.with(|n| *n.borrow_mut() = Some(ndb));
    POOL.with(|p| *p.borrow_mut() = Some(pool));

    loop {
        // Process relay events
        POOL.with(|p| {
            if let Some(pool) = p.borrow_mut().as_mut() {
                for i in 0..pool.relays.len() {
                    while let Some(event) = pool.relays[i].try_recv() {
                        let relay_url = pool.relays[i].url().to_string();
                        match event {
                            ewebsock::WsEvent::Message(ewebsock::WsMessage::Text(text)) => {
                                debug!(relay = %relay_url, len = text.len(), "Received message");

                                // Process through nostrdb (validates signature)
                                NDB.with(|n| {
                                    if let Some(ndb) = n.borrow_mut().as_mut() {
                                        match ndb.process_event(&text) {
                                            Ok(_) => {
                                                debug!("Event validated, forwarding to frontend");
                                                // Parse relay message to extract event and sub ID
                                                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&text) {
                                                    if let Some(arr) = msg.as_array() {
                                                        if arr.len() >= 3 && arr[0].as_str() == Some("EVENT") {
                                                            if let (Some(sub_id), Some(event)) = (arr[1].as_str(), arr.get(2)) {
                                                                let _ = app_handle.emit("nostr_event", NostrResponse::Event {
                                                                    sub_id: sub_id.to_string(),
                                                                    event: event.clone(),
                                                                    relay: Some(relay_url.clone()),
                                                                });
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                warn!(error = ?e, "Event rejected");
                                            }
                                        }
                                    }
                                });
                            }
                            ewebsock::WsEvent::Opened => {
                                info!(relay = %relay_url, "Connected");
                                pool.relays[i].set_status(enostr::RelayStatus::Connected);
                                let _ = app_handle.emit("nostr_event", serde_json::json!({
                                    "type": "relayConnected",
                                    "relay": relay_url
                                }));
                            }
                            ewebsock::WsEvent::Closed => {
                                info!(relay = %relay_url, "Disconnected");
                                pool.relays[i].set_status(enostr::RelayStatus::Disconnected);
                                let _ = app_handle.emit("nostr_event", serde_json::json!({
                                    "type": "relayDisconnected",
                                    "relay": relay_url
                                }));
                            }
                            ewebsock::WsEvent::Error(e) => {
                                error!(relay = %relay_url, error = %e, "Relay error");
                            }
                            _ => {
                                // Ignore other message types (Binary, Ping, Pong, Unknown)
                            }
                        }
                    }
                }
            }
        });

        // Process commands
        match rx.try_recv() {
            Ok(NostrRequest::Init) => {
                let _ = app_handle.emit("nostr_event", NostrResponse::Ready);
            }
            Ok(NostrRequest::AddRelay { url }) => {
                info!(relay = %url, "Adding relay");
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let wakeup = || {};
                        match pool.add_url(url.clone(), wakeup) {
                            Ok(_) => {
                                info!(relay = %url, "Relay added");
                                let _ = app_handle.emit("nostr_event", serde_json::json!({
                                    "type": "relayAdded",
                                    "url": url
                                }));
                            }
                            Err(e) => error!(relay = %url, error = ?e, "Failed to add relay"),
                        }
                    }
                });
            }
            Ok(NostrRequest::GetRelayStatus { id }) => {
                debug!(id = %id, "GetRelayStatus request");
                POOL.with(|p| {
                    if let Some(pool) = p.borrow().as_ref() {
                        debug!(count = pool.relays.len(), "Relay pool status");
                        let statuses: Vec<RelayStatusInfo> = pool.relays.iter().map(|relay| {
                            RelayStatusInfo {
                                url: relay.url().to_string(),
                                // Map to NDK status values: CONNECTED=5, CONNECTING=1, DISCONNECTED=4
                                status: match relay.status() {
                                    enostr::RelayStatus::Connected => 5,
                                    enostr::RelayStatus::Connecting => 1,
                                    enostr::RelayStatus::Disconnected => 4,
                                },
                            }
                        }).collect();

                        debug!(count = statuses.len(), "Emitting relay status");
                        let _ = app_handle.emit("nostr_event", NostrResponse::RelayStatus {
                            id,
                            relay_statuses: statuses,
                        });
                    }
                });
            }
            Ok(NostrRequest::Subscribe { id, filters, subscribe_opts: _ }) => {
                info!(sub_id = %id, filter_count = filters.len(), "Subscribe request");

                // Parse JSON filters
                let parsed_filters: Vec<Filter> = filters
                    .iter()
                    .filter_map(|f| parse_filter(f))
                    .collect();

                if parsed_filters.is_empty() {
                    warn!(sub_id = %id, "No valid filters");
                    return;
                }

                let filter = if !parsed_filters.is_empty() {
                    parsed_filters[0].clone()
                } else {
                    Filter::new().limit(500).build()
                };

                // Subscribe in nostrdb (local storage)
                let _ndb_sub_id = NDB.with(|n| {
                    if let Some(ndb) = n.borrow().as_ref() {
                        match ndb.subscribe(&[filter.clone()]) {
                            Ok(sub) => {
                                let ndb_id = sub.id();
                                SUBSCRIPTIONS.with(|subs| {
                                    subs.borrow_mut().insert(id.clone(), sub);
                                });
                                SUB_ID_MAP.with(|map| {
                                    map.borrow_mut().insert(ndb_id, id.clone());
                                });
                                debug!(sub_id = %id, ndb_id = ndb_id, "Created nostrdb subscription");
                                Some(ndb_id)
                            }
                            Err(e) => {
                                error!(sub_id = %id, error = ?e, "Nostrdb subscribe failed");
                                None
                            }
                        }
                    } else {
                        None
                    }
                });

                // Send REQ to relays
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let req_msg = ClientMessage::req(id.clone(), parsed_filters.clone());
                        pool.send(&req_msg);
                        info!(sub_id = %id, relay_count = pool.relays.len(), filter_count = parsed_filters.len(), "Sent REQ to relays");
                    }
                });
            }
            Ok(NostrRequest::Publish { id, event, publish_opts: _ }) => {
                info!(pub_id = %id, "Publish request");

                // Publish event to relays
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let event_json = serde_json::to_string(&event).unwrap_or_default();

                        match ClientMessage::event_json(event_json) {
                            Ok(msg) => {
                                for relay in &mut pool.relays {
                                    if let Err(e) = relay.send(&msg) {
                                        error!(error = ?e, "Failed to publish to relay");
                                    }
                                }
                                info!(relay_count = pool.relays.len(), "Published to relays");
                                let _ = app_handle.emit("nostr_event", NostrResponse::Published { id });
                            }
                            Err(e) => {
                                error!(error = ?e, "Invalid event message");
                                let _ = app_handle.emit("nostr_event", NostrResponse::Error {
                                    id: Some(id),
                                    error: format!("Invalid event: {:?}", e),
                                });
                            }
                        }
                    }
                });
            }
            Ok(NostrRequest::Unsubscribe { id }) => {
                SUBSCRIPTIONS.with(|subs| {
                    subs.borrow_mut().remove(&id);
                });
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let close_msg = ClientMessage::close(id.clone());
                        pool.send(&close_msg);
                        debug!(sub_id = %id, "Sent CLOSE to relays");
                    }
                });
            }
            Ok(NostrRequest::RemoveRelay { url }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        pool.relays.retain(|r| r.url() != url);
                        info!(relay = %url, "Relay removed");
                    }
                });
            }
            Ok(NostrRequest::ConnectRelay { url }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        for relay in &mut pool.relays {
                            if relay.url() == url {
                                // Relay already exists, just update status
                                relay.set_status(enostr::RelayStatus::Connecting);
                                info!(relay = %url, "Reconnecting relay");
                                return;
                            }
                        }
                    }
                });
            }
            Ok(NostrRequest::DisconnectRelay { url }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        for relay in &mut pool.relays {
                            if relay.url() == url {
                                relay.set_status(enostr::RelayStatus::Disconnected);
                                info!(relay = %url, "Disconnected relay");
                                break;
                            }
                        }
                    }
                });
            }
            Ok(NostrRequest::ReconnectDisconnected { reason }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let mut reconnected = 0;
                        for relay in &mut pool.relays {
                            if matches!(relay.status(), enostr::RelayStatus::Disconnected) {
                                relay.set_status(enostr::RelayStatus::Connecting);
                                reconnected += 1;
                            }
                        }
                        info!(count = reconnected, reason = ?reason, "Reconnecting disconnected relays");
                    }
                });
            }
            Ok(NostrRequest::Close) => {
                info!("Close command received");
                break;
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {},
            Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
        }

        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}
