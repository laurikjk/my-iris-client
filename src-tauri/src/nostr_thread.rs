use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::mpsc::Receiver;
use nostrdb::{Ndb, Config, Subscription};
use enostr::{RelayPool, ewebsock};
use tauri::Emitter;
use tracing::{debug, info, warn, error};
use crate::nostr_types::{NostrRequest, NostrResponse, RelayStatusInfo};
use crate::relay_handlers;
use crate::subscription_handlers;

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
    let mut pool = RelayPool::new();

    // Add multicast relay for local network discovery (WebRTC signaling)
    let wakeup = || {}; // No-op wakeup
    match enostr::PoolRelay::multicast(wakeup) {
        Ok(multicast_relay) => {
            pool.relays.push(multicast_relay);
            info!("Multicast relay enabled for local network discovery");
        }
        Err(e) => {
            warn!(error = ?e, "Failed to setup multicast relay");
        }
    }

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
                                        // Try to parse as relay message first
                                        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&text) {
                                            if let Some(arr) = msg.as_array() {
                                                match arr.get(0).and_then(|v| v.as_str()) {
                                                    Some("EVENT") if arr.len() >= 3 => {
                                                        // Validate with nostrdb
                                                        match ndb.process_event(&text) {
                                                            Ok(_) => {
                                                                debug!("Event validated, forwarding");
                                                                if let (Some(sub_id), Some(event)) = (arr[1].as_str(), arr.get(2)) {
                                                                    let _ = app_handle.emit("nostr_event", NostrResponse::Event {
                                                                        sub_id: sub_id.to_string(),
                                                                        event: event.clone(),
                                                                        relay: Some(relay_url.clone()),
                                                                    });
                                                                }
                                                            }
                                                            Err(e) => {
                                                                warn!(error = ?e, "Event rejected");
                                                            }
                                                        }
                                                    }
                                                    Some("NOTICE") if arr.len() >= 2 => {
                                                        if let Some(notice) = arr[1].as_str() {
                                                            warn!(relay = %relay_url, notice = %notice, "Relay notice");
                                                        }
                                                    }
                                                    Some("EOSE") if arr.len() >= 2 => {
                                                        if let Some(sub_id) = arr[1].as_str() {
                                                            debug!(relay = %relay_url, sub_id = %sub_id, "End of stored events");
                                                            let _ = app_handle.emit("nostr_event", NostrResponse::Eose {
                                                                sub_id: sub_id.to_string(),
                                                            });
                                                        }
                                                    }
                                                    Some("OK") => {
                                                        debug!(relay = %relay_url, "Event accepted");
                                                    }
                                                    _ => {
                                                        debug!(relay = %relay_url, msg = %&text[..text.len().min(100)], "Unknown message");
                                                    }
                                                }
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
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        relay_handlers::handle_add_relay(pool, url, &app_handle);
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
            Ok(NostrRequest::Subscribe { id, filters, subscribe_opts }) => {
                NDB.with(|n| {
                    POOL.with(|p| {
                        SUBSCRIPTIONS.with(|subs| {
                            SUB_ID_MAP.with(|map| {
                                if let (Some(ndb), Some(pool)) = (n.borrow().as_ref(), p.borrow_mut().as_mut()) {
                                    subscription_handlers::handle_subscribe(
                                        id,
                                        filters,
                                        subscribe_opts,
                                        ndb,
                                        pool,
                                        &mut subs.borrow_mut(),
                                        &mut map.borrow_mut(),
                                        &app_handle,
                                    );
                                }
                            });
                        });
                    });
                });
            }
            Ok(NostrRequest::Publish { id, event, publish_opts }) => {
                NDB.with(|n| {
                    POOL.with(|p| {
                        if let (Some(ndb), Some(pool)) = (n.borrow().as_ref(), p.borrow_mut().as_mut()) {
                            subscription_handlers::handle_publish(id, event, publish_opts, ndb, pool, &app_handle);
                        }
                    });
                });
            }
            Ok(NostrRequest::Unsubscribe { id }) => {
                POOL.with(|p| {
                    SUBSCRIPTIONS.with(|subs| {
                        if let Some(pool) = p.borrow_mut().as_mut() {
                            subscription_handlers::handle_unsubscribe(id, pool, &mut subs.borrow_mut());
                        }
                    });
                });
            }
            Ok(NostrRequest::RemoveRelay { url }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        relay_handlers::handle_remove_relay(pool, url);
                    }
                });
            }
            Ok(NostrRequest::ConnectRelay { url }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        relay_handlers::handle_connect_relay(pool, url);
                    }
                });
            }
            Ok(NostrRequest::DisconnectRelay { url }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        relay_handlers::handle_disconnect_relay(pool, url);
                    }
                });
            }
            Ok(NostrRequest::ReconnectDisconnected { reason }) => {
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        relay_handlers::handle_reconnect_disconnected(pool, reason);
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
