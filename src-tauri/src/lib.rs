use serde::{Deserialize, Serialize};
use tauri::{Manager, Listener};

#[derive(Debug, Serialize, Deserialize)]
struct PushTokenPayload {
    token: String,
    platform: String, // "ios" or "android"
}

#[tauri::command]
async fn register_push_token(token: String, platform: String) -> Result<String, String> {
    // This will be called from the frontend when we get a push token
    log::info!("Received push token for {}: {}", platform, &token[..8.min(token.len())]);

    // The frontend should handle sending this to the notification server
    // Return success for now
    Ok("Token registered".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Add notification plugin
      app.handle().plugin(tauri_plugin_notification::init())?;

      // Setup push notification handler for mobile
      #[cfg(mobile)]
      {
        let handle = app.handle().clone();

        // Listen for notification events
        app.listen("notification-received", move |event| {
          log::info!("Notification received: {:?}", event);
        });
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![register_push_token])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
