#[cfg(mobile)]
use tauri::Listener;
use tauri::{Manager, Emitter};
use std::cell::RefCell;
use std::sync::mpsc::{channel, Sender, Receiver};
use nostrdb::{Ndb, Config, Filter, FilterBuilder, Subscription};
use enostr::{RelayPool, ewebsock, ClientMessage};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

thread_local! {
    static NDB: RefCell<Option<Ndb>> = RefCell::new(None);
    static POOL: RefCell<Option<RelayPool>> = RefCell::new(None);
    static SUBSCRIPTIONS: RefCell<HashMap<String, Subscription>> = RefCell::new(HashMap::new());
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum NostrRequest {
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
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubscribeOpts {
    destinations: Option<Vec<String>>,
    #[serde(rename = "closeOnEose")]
    close_on_eose: Option<bool>,
    groupable: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PublishOpts {
    #[serde(rename = "publishTo")]
    publish_to: Option<Vec<String>>,
    #[serde(rename = "verifySignature")]
    verify_signature: Option<bool>,
    source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum NostrResponse {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RelayStatusInfo {
    url: String,
    status: u8,
}

struct AppState {
    nostr_tx: Sender<NostrRequest>,
}

#[tauri::command]
async fn nostr_message(msg: NostrRequest, state: tauri::State<'_, AppState>) -> Result<(), String> {
    log::info!("📬 Received from frontend: {:?}", msg);
    state.nostr_tx.send(msg).map_err(|e| e.to_string())
}

fn nostr_thread(rx: &Receiver<NostrRequest>, db_path: &str, app_handle: tauri::AppHandle) {
    // Initialize on this thread
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
                                log::debug!("📨 Received from relay {}: {}", relay_url, &text[..text.len().min(100)]);

                                // Process through nostrdb (validates signature)
                                NDB.with(|n| {
                                    if let Some(ndb) = n.borrow_mut().as_mut() {
                                        match ndb.process_event(&text) {
                                            Ok(_) => {
                                                log::debug!("✅ Event processed and validated by nostrdb");
                                                // TODO: Extract event from text and forward to frontend
                                            }
                                            Err(e) => {
                                                log::warn!("⚠️ Nostrdb rejected event (invalid sig or duplicate): {:?}", e);
                                            }
                                        }
                                    }
                                });
                            }
                            ewebsock::WsEvent::Opened => {
                                log::info!("🔗 Relay connected: {}", relay_url);
                                pool.relays[i].set_status(enostr::RelayStatus::Connected);
                                let _ = app_handle.emit("nostr_event", serde_json::json!({
                                    "type": "relayConnected",
                                    "relay": relay_url
                                }));
                            }
                            ewebsock::WsEvent::Closed => {
                                log::info!("🔌 Relay disconnected: {}", relay_url);
                                pool.relays[i].set_status(enostr::RelayStatus::Disconnected);
                                let _ = app_handle.emit("nostr_event", serde_json::json!({
                                    "type": "relayDisconnected",
                                    "relay": relay_url
                                }));
                            }
                            ewebsock::WsEvent::Error(e) => {
                                log::error!("❌ Relay error {}: {}", relay_url, e);
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
                log::info!("🔌 Nostr thread initialized, sending Ready to frontend");
                let _ = app_handle.emit("nostr_event", NostrResponse::Ready);
            }
            Ok(NostrRequest::AddRelay { url }) => {
                log::info!("➕ Adding relay: {}", url);
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let wakeup = || {};
                        match pool.add_url(url.clone(), wakeup) {
                            Ok(_) => {
                                log::info!("✅ Relay added: {}", url);
                                // Emit relay added event
                                let _ = app_handle.emit("nostr_event", serde_json::json!({
                                    "type": "relayAdded",
                                    "url": url
                                }));
                            }
                            Err(e) => log::error!("❌ Failed to add relay {}: {:?}", url, e),
                        }
                    }
                });
            }
            Ok(NostrRequest::GetRelayStatus { id }) => {
                log::info!("📊 GetRelayStatus request with id: {}", id);
                POOL.with(|p| {
                    if let Some(pool) = p.borrow().as_ref() {
                        log::info!("Pool has {} relays", pool.relays.len());
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

                        log::info!("📡 Emitting relay status with {} relays", statuses.len());
                        let _ = app_handle.emit("nostr_event", NostrResponse::RelayStatus {
                            id,
                            relay_statuses: statuses,
                        });
                    }
                });
            }
            Ok(NostrRequest::Subscribe { id, filters, subscribe_opts }) => {
                log::info!("🔔 Subscribe request: {} with {} filters", id, filters.len());

                NDB.with(|n| {
                    if let Some(ndb) = n.borrow().as_ref() {
                        // TODO: Parse JSON filters to nostrdb::Filter
                        // For now, create a basic filter
                        let filter = Filter::new().limit(100).build();

                        match ndb.subscribe(&[filter]) {
                            Ok(sub) => {
                                SUBSCRIPTIONS.with(|subs| {
                                    subs.borrow_mut().insert(id.clone(), sub);
                                });
                                log::info!("✅ Created nostrdb subscription: {}", id);
                            }
                            Err(e) => {
                                log::error!("❌ Failed to subscribe: {:?}", e);
                                let _ = app_handle.emit("nostr_event", NostrResponse::Error {
                                    id: Some(id),
                                    error: format!("Subscribe failed: {:?}", e),
                                });
                            }
                        }
                    }
                });

                // Also subscribe on relay pool
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        // TODO: Convert filters and send to relays
                        log::debug!("TODO: Send subscription to relays");
                    }
                });
            }
            Ok(NostrRequest::Publish { id, event, publish_opts }) => {
                log::info!("📤 Publish request: {}", id);

                // Publish event to relays
                POOL.with(|p| {
                    if let Some(pool) = p.borrow_mut().as_mut() {
                        let event_json = serde_json::to_string(&event).unwrap_or_default();

                        match ClientMessage::event_json(event_json) {
                            Ok(msg) => {
                                for relay in &mut pool.relays {
                                    if let Err(e) = relay.send(&msg) {
                                        log::error!("Failed to publish to relay: {:?}", e);
                                    }
                                }
                                log::info!("✅ Published to {} relays", pool.relays.len());
                                let _ = app_handle.emit("nostr_event", NostrResponse::Published { id });
                            }
                            Err(e) => {
                                log::error!("❌ Failed to create event message: {:?}", e);
                                let _ = app_handle.emit("nostr_event", NostrResponse::Error {
                                    id: Some(id),
                                    error: format!("Invalid event: {:?}", e),
                                });
                            }
                        }
                    }
                });
            }
            Ok(NostrRequest::Close) => {
                log::info!("🛑 Nostr thread received Close command");
                break;
            }
            Ok(req) => {
                log::debug!("📨 Unhandled request: {:?}", req);
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {},
            Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
        }

        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![nostr_message])
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create data dir");
            let db_path = data_dir.join("nostrdb");
            std::fs::create_dir_all(&db_path).expect("failed to create db dir");

            let (tx, rx) = channel();

            let db_path_str = db_path.to_str().unwrap().to_string();
            let app_handle = app.handle().clone();

            // Spawn with panic recovery
            std::thread::Builder::new()
                .name("nostr".into())
                .spawn(move || {
                    loop {
                        let handle_clone = app_handle.clone();
                        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            nostr_thread(&rx, &db_path_str, handle_clone);
                        }));

                        match result {
                            Ok(_) => {
                                log::info!("Nostr thread exited normally");
                                break;
                            }
                            Err(e) => {
                                log::error!("Nostr thread panicked: {:?}, restarting...", e);
                                std::thread::sleep(std::time::Duration::from_secs(1));
                                // Thread restarts loop
                            }
                        }
                    }
                })
                .expect("failed to spawn nostr thread");

            app.manage(AppState { nostr_tx: tx });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Check if launched with --minimized flag (from autostart) - desktop only
            #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
            {
                let args: Vec<String> = std::env::args().collect();
                if args.contains(&"--minimized".to_string()) {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.minimize();
                    }
                }
            }

            // Add notification plugin
            app.handle().plugin(tauri_plugin_notification::init())?;

            // Add opener plugin for external links
            app.handle().plugin(tauri_plugin_opener::init())?;

            // Add dialog plugin
            app.handle().plugin(tauri_plugin_dialog::init())?;

            // Add deep link handler
            app.handle().plugin(tauri_plugin_deep_link::init())?;

            // Add autostart plugin for desktop platforms
            #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--minimized"]),
            ))?;

            // Add iOS swipe navigation
            #[cfg(target_os = "ios")]
            app.handle().plugin(tauri_plugin_swipe_back_ios::init())?;

            // Setup push notification handler for mobile
            #[cfg(mobile)]
            {
                let _handle = app.handle().clone();

                // Listen for notification events
                app.listen("notification-received", move |event| {
                    log::info!("Notification received: {:?}", event);
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
