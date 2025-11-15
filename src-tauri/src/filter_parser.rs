use nostrdb::Filter;

// Helper to convert Vec<T> to Vec<&T> without extra indirection
fn to_refs<T>(v: &[T]) -> Vec<&T> {
    v.iter().collect()
}

/// Parse NDK-style JSON filter to nostrdb::Filter
pub fn parse_filter(json: &serde_json::Value) -> Option<Filter> {
    let obj = json.as_object()?;
    let mut builder = Filter::new();

    // Parse authors (hex strings -> byte arrays)
    if let Some(authors) = obj.get("authors").and_then(|v| v.as_array()) {
        let author_bytes: Vec<[u8; 32]> = authors
            .iter()
            .filter_map(|v| v.as_str())
            .filter_map(|s| {
                hex::decode(s).ok()?.try_into().ok()
            })
            .collect();
        if !author_bytes.is_empty() {
            builder = builder.authors(to_refs(&author_bytes));
        }
    }

    // Parse kinds
    if let Some(kinds) = obj.get("kinds").and_then(|v| v.as_array()) {
        let kind_nums: Vec<u64> = kinds
            .iter()
            .filter_map(|v| v.as_u64())
            .collect();
        if !kind_nums.is_empty() {
            builder = builder.kinds(kind_nums);
        }
    }

    // Parse IDs (hex strings -> byte arrays)
    if let Some(ids) = obj.get("ids").and_then(|v| v.as_array()) {
        let id_bytes: Vec<[u8; 32]> = ids
            .iter()
            .filter_map(|v| v.as_str())
            .filter_map(|s| {
                hex::decode(s).ok()?.try_into().ok()
            })
            .collect();
        if !id_bytes.is_empty() {
            builder = builder.ids(to_refs(&id_bytes));
        }
    }

    // Parse #e tags (hex strings -> byte arrays)
    if let Some(e_tags) = obj.get("#e").and_then(|v| v.as_array()) {
        let e_bytes: Vec<[u8; 32]> = e_tags
            .iter()
            .filter_map(|v| v.as_str())
            .filter_map(|s| {
                hex::decode(s).ok()?.try_into().ok()
            })
            .collect();
        if !e_bytes.is_empty() {
            builder = builder.events(to_refs(&e_bytes));
        }
    }

    // Parse #p tags (hex strings -> byte arrays)
    if let Some(p_tags) = obj.get("#p").and_then(|v| v.as_array()) {
        let p_bytes: Vec<[u8; 32]> = p_tags
            .iter()
            .filter_map(|v| v.as_str())
            .filter_map(|s| {
                hex::decode(s).ok()?.try_into().ok()
            })
            .collect();
        if !p_bytes.is_empty() {
            builder = builder.pubkeys(to_refs(&p_bytes));
        }
    }

    // Parse all generic #<char> tags dynamically
    for (key, value) in obj.iter() {
        if key.starts_with('#') && key.len() == 2 {
            if let Some(tag_char) = key.chars().nth(1) {
                if let Some(tag_values) = value.as_array() {
                    let tag_strs: Vec<&str> = tag_values
                        .iter()
                        .filter_map(|v| v.as_str())
                        .collect();
                    if !tag_strs.is_empty() {
                        builder = builder.tags(tag_strs, tag_char);
                    }
                }
            }
        }
    }

    // Parse since
    if let Some(since) = obj.get("since").and_then(|v| v.as_u64()) {
        builder = builder.since(since);
    }

    // Parse until
    if let Some(until) = obj.get("until").and_then(|v| v.as_u64()) {
        builder = builder.until(until);
    }

    // Parse limit
    if let Some(limit) = obj.get("limit").and_then(|v| v.as_u64()) {
        builder = builder.limit(limit);
    }

    Some(builder.build())
}
