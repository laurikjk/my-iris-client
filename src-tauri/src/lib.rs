#[cfg(mobile)]
use tauri::Listener;
use tauri::Manager;
use std::cell::RefCell;
use std::sync::mpsc::{channel, Sender, Receiver};
use nostrdb::{Ndb, Config};
use enostr::{RelayPool, ewebsock};

thread_local! {
    static NDB: RefCell<Option<Ndb>> = RefCell::new(None);
    static POOL: RefCell<Option<RelayPool>> = RefCell::new(None);
}

enum NostrRequest {
    // Add request types as needed
    Shutdown,
}

enum NostrResponse {
    // Add response types as needed
}

struct AppState {
    nostr_tx: Sender<NostrRequest>,
}

fn nostr_thread(rx: &Receiver<NostrRequest>, db_path: &str) {
    // Initialize on this thread
    let config = Config::new();
    let ndb = Ndb::new(&db_path, &config).expect("failed to initialize nostrdb");
    let mut pool = RelayPool::new();

    // Add default relays (same as Damus notedeck)
    let default_relays = [
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://nostr.wine",
        "wss://purplepag.es",
        "wss://temp.iris.to",
        "wss://relay.snort.social",
    ];

    let wakeup = || {}; // No-op wakeup for now
    for relay_url in &default_relays {
        match pool.add_url(relay_url.to_string(), wakeup) {
            Ok(_) => log::info!("Added relay: {}", relay_url),
            Err(e) => log::error!("Failed to add relay {}: {:?}", relay_url, e),
        }
    }

    NDB.with(|n| *n.borrow_mut() = Some(ndb));
    POOL.with(|p| *p.borrow_mut() = Some(pool));

    loop {
        // Process relay events
        POOL.with(|p| {
            if let Some(pool) = p.borrow_mut().as_mut() {
                for relay in &pool.relays {
                    while let Some(event) = relay.try_recv() {
                        if let ewebsock::WsEvent::Message(ewebsock::WsMessage::Text(text)) = event {
                            NDB.with(|n| {
                                if let Some(ndb) = n.borrow_mut().as_mut() {
                                    let _ = ndb.process_event(&text);
                                }
                            });
                        }
                    }
                }
            }
        });

        // Process commands
        match rx.try_recv() {
            Ok(NostrRequest::Shutdown) => break,
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
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create data dir");
            let db_path = data_dir.join("nostrdb");
            std::fs::create_dir_all(&db_path).expect("failed to create db dir");

            let (tx, rx) = channel();

            let db_path_str = db_path.to_str().unwrap().to_string();

            // Spawn with panic recovery
            std::thread::Builder::new()
                .name("nostr".into())
                .spawn(move || {
                    loop {
                        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            nostr_thread(&rx, &db_path_str);
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
