#[cfg(mobile)]
use tauri::Listener;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
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
