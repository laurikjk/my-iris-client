mod filter_parser;
mod nostr_types;
mod nostr_thread;

#[cfg(mobile)]
use tauri::Listener;
use tauri::Manager;
use std::sync::mpsc::{channel, Sender};
use tracing::{info, error};
use tracing_subscriber::EnvFilter;
use nostr_types::NostrRequest;
use nostr_thread::nostr_thread;

struct AppState {
    nostr_tx: Sender<NostrRequest>,
}

#[tauri::command]
async fn nostr_message(msg: NostrRequest, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.nostr_tx.send(msg).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing with env filter (RUST_LOG=iris=debug)
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("iris=info,enostr=debug"))
        )
        .init();

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
                                info!("Nostr thread exited normally");
                                break;
                            }
                            Err(e) => {
                                error!(panic = ?e, "Nostr thread panicked, restarting");
                                std::thread::sleep(std::time::Duration::from_secs(1));
                                // Thread restarts loop
                            }
                        }
                    }
                })
                .expect("failed to spawn nostr thread");

            app.manage(AppState { nostr_tx: tx });

            // Logging handled by tracing-subscriber

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
                    info!(event = ?event, "Notification received");
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
