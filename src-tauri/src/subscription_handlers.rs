use std::collections::HashMap;
use nostrdb::{Ndb, Filter, Subscription, Transaction};
use enostr::{RelayPool, ClientMessage};
use tauri::Emitter;
use tracing::{debug, info, warn, error};
use crate::nostr_types::{NostrResponse, SubscribeOpts, PublishOpts};
use crate::filter_parser::parse_filter;

pub fn handle_subscribe(
    id: String,
    filters: Vec<serde_json::Value>,
    subscribe_opts: Option<SubscribeOpts>,
    ndb: &Ndb,
    pool: &mut RelayPool,
    subscriptions: &mut HashMap<String, Subscription>,
    sub_id_map: &mut HashMap<u64, String>,
    _app_handle: &tauri::AppHandle,
) {
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

    // Check if cache-only
    let cache_only = subscribe_opts
        .as_ref()
        .and_then(|opts| opts.destinations.as_ref())
        .map(|dests| dests.contains(&"cache".to_string()) && !dests.contains(&"relay".to_string()))
        .unwrap_or(false);

    let filter = parsed_filters[0].clone();

    // Subscribe in nostrdb
    match ndb.subscribe(&[filter.clone()]) {
        Ok(sub) => {
            let ndb_id = sub.id();
            subscriptions.insert(id.clone(), sub);
            sub_id_map.insert(ndb_id, id.clone());
            debug!(sub_id = %id, ndb_id = ndb_id, "Created nostrdb subscription");
        }
        Err(e) => {
            error!(sub_id = %id, error = ?e, "Nostrdb subscribe failed");
        }
    }

    // Send REQ to relays (unless cache-only)
    if !cache_only {
        // Check if filter has ids - optimize by checking cache first
        let mut relay_filters = parsed_filters.clone();
        let mut total_ids = 0;
        let mut found_ids = 0;

        for filter in &mut relay_filters {
            if let Some(ids_field) = filter.into_iter().find_map(|field| {
                if let nostrdb::FilterField::Ids(ids) = field {
                    Some(ids)
                } else {
                    None
                }
            }) {
                let txn = Transaction::new(ndb).ok();
                if let Some(ref txn) = txn {
                    let mut unfound_ids = Vec::new();

                    for id in ids_field.into_iter() {
                        total_ids += 1;
                        // Check if event exists in nostrdb
                        if ndb.get_notekey_by_id(txn, id).is_err() {
                            unfound_ids.push(*id);
                        } else {
                            found_ids += 1;
                        }
                    }

                    if found_ids > 0 {
                        debug!(sub_id = %id, found = found_ids, total = total_ids, "Cache hits for event IDs");
                    }

                    // Skip relay REQ if all events found in cache
                    if unfound_ids.is_empty() {
                        debug!(sub_id = %id, "All events in cache, skipping relay REQ");
                        return;
                    }

                    // Replace filter ids with only unfound ones
                    *filter = nostrdb::Filter::new().ids(unfound_ids.iter()).build();
                }
            }
        }

        if found_ids > 0 {
            let req_msg = ClientMessage::req(id.clone(), relay_filters);
            pool.send(&req_msg);
            info!(sub_id = %id, relay_count = pool.relays.len(), cached = found_ids, requesting = total_ids - found_ids, "Sent optimized REQ to relays");
        } else {
            let filter_count = relay_filters.len();
            let req_msg = ClientMessage::req(id.clone(), relay_filters);
            pool.send(&req_msg);
            info!(sub_id = %id, relay_count = pool.relays.len(), filter_count = filter_count, "Sent REQ to relays");
        }
    } else {
        debug!(sub_id = %id, "Cache-only query, skipping relays");
    }
}

pub fn handle_unsubscribe(
    id: String,
    pool: &mut RelayPool,
    subscriptions: &mut HashMap<String, Subscription>,
) {
    subscriptions.remove(&id);
    let close_msg = ClientMessage::close(id.clone());
    pool.send(&close_msg);
    debug!(sub_id = %id, "Sent CLOSE to relays");
}

pub fn handle_publish(
    id: String,
    event: serde_json::Value,
    publish_opts: Option<PublishOpts>,
    ndb: &Ndb,
    pool: &mut RelayPool,
    app_handle: &tauri::AppHandle,
) {
    let destinations = publish_opts
        .as_ref()
        .and_then(|opts| opts.publish_to.as_ref())
        .map(|v| v.clone())
        .unwrap_or_else(|| vec!["relay".to_string()]);

    let event_json = serde_json::to_string(&event).unwrap_or_default();

    // Dispatch to local subscriptions (WebRTC events from untrusted sources)
    if destinations.contains(&"subscriptions".to_string()) {
        if let Some(source) = publish_opts.as_ref().and_then(|o| o.source.as_ref()) {
            debug!(source = %source, event_id = ?event.get("id"), "Dispatching to local subscriptions");
        }

        // Process through nostrdb (validates + stores + dispatches to subs)
        let _ = ndb.process_event(&event_json);
    }

    // Publish to relays if requested
    if destinations.contains(&"relay".to_string()) {
        match ClientMessage::event_json(event_json) {
            Ok(msg) => {
                pool.send(&msg);
                info!(pub_id = %id, relay_count = pool.relays.len(), "Published to relays/multicast");
                let _ = app_handle.emit("nostr_event", NostrResponse::Published { id });
            }
            Err(e) => {
                error!(pub_id = %id, error = ?e, "Invalid event");
                let _ = app_handle.emit("nostr_event", NostrResponse::Error {
                    id: Some(id),
                    error: format!("Invalid event: {:?}", e),
                });
            }
        }
    } else {
        // Not publishing to relays, but ack success
        let _ = app_handle.emit("nostr_event", NostrResponse::Published { id });
    }
}
