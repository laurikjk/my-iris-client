use enostr::RelayPool;
use tauri::Emitter;
use tracing::{info, error};

pub fn handle_add_relay(pool: &mut RelayPool, url: String, app_handle: &tauri::AppHandle) {
    info!(relay = %url, "Adding relay");
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

pub fn handle_remove_relay(pool: &mut RelayPool, url: String) {
    pool.relays.retain(|r| r.url() != url);
    info!(relay = %url, "Relay removed");
}

pub fn handle_connect_relay(pool: &mut RelayPool, url: String) {
    for relay in &mut pool.relays {
        if relay.url() == url {
            relay.set_status(enostr::RelayStatus::Connecting);
            info!(relay = %url, "Reconnecting relay");
            return;
        }
    }
}

pub fn handle_disconnect_relay(pool: &mut RelayPool, url: String) {
    for relay in &mut pool.relays {
        if relay.url() == url {
            relay.set_status(enostr::RelayStatus::Disconnected);
            info!(relay = %url, "Disconnected relay");
            break;
        }
    }
}

pub fn handle_reconnect_disconnected(pool: &mut RelayPool, reason: Option<String>) {
    let mut reconnected = 0;
    for relay in &mut pool.relays {
        if matches!(relay.status(), enostr::RelayStatus::Disconnected) {
            relay.set_status(enostr::RelayStatus::Connecting);
            reconnected += 1;
        }
    }
    info!(count = reconnected, reason = ?reason, "Reconnecting disconnected relays");
}
