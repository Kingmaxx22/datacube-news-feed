use std::collections::HashMap;
use std::time::{Duration, Instant};

use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State};

const API_BASE: &str = "https://api-production-3ee5.up.railway.app";
const CACHE_TTL: Duration = Duration::from_secs(600);
const USER_AGENT: &str = concat!("CyberSlateIntelligence/", env!("CARGO_PKG_VERSION"));

const FEED_KINDS: [&str; 5] = ["tech", "investment", "tips", "videos", "trends"];

struct CacheEntry {
    fetched_at: Instant,
    body: Value,
    latency_ms: u64,
    bytes: usize,
}

pub struct ApiState {
    client: Client,
    cache: std::sync::Mutex<HashMap<String, CacheEntry>>,
}

impl ApiState {
    fn new() -> Result<Self, String> {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(25))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| format!("HTTP client init failed: {e}"))?;
        Ok(Self {
            client,
            cache: std::sync::Mutex::new(HashMap::new()),
        })
    }

    fn cache_get(&self, key: &str) -> Option<(Value, u64, usize, u64)> {
        let cache = self.cache.lock().ok()?;
        let entry = cache.get(key)?;
        let age_ms = entry.fetched_at.elapsed().as_millis() as u64;
        if age_ms > CACHE_TTL.as_millis() as u64 {
            return None;
        }
        Some((entry.body.clone(), entry.latency_ms, entry.bytes, age_ms))
    }

    fn cache_put(&self, key: String, entry: CacheEntry) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(key, entry);
        }
    }
}

#[derive(Serialize)]
pub struct ApiEnvelope {
    url: String,
    body: Value,
    latency_ms: u64,
    bytes: usize,
    cache_age_ms: u64,
    cached: bool,
    status: u16,
}

#[derive(Serialize)]
pub struct ApiError {
    status: u16,
    url: String,
    message: String,
}

async fn get_json(
    state: &ApiState,
    url: &str,
    bypass_cache: bool,
) -> Result<ApiEnvelope, ApiError> {
    if !bypass_cache {
        if let Some((body, latency_ms, bytes, age_ms)) = state.cache_get(url) {
            return Ok(ApiEnvelope {
                url: url.to_string(),
                body,
                latency_ms,
                bytes,
                cache_age_ms: age_ms,
                cached: true,
                status: 200,
            });
        }
    }

    let started = Instant::now();
    let response = state
        .client
        .get(url)
        .send()
        .await
        .map_err(|e| ApiError {
            status: 0,
            url: url.to_string(),
            message: describe_reqwest_error(&e),
        })?;

    let status = response.status();
    let raw = response.bytes().await.map_err(|e| ApiError {
        status: status.as_u16(),
        url: url.to_string(),
        message: format!("response body read failed: {e}"),
    })?;
    let bytes = raw.len();

    if !status.is_success() {
        let snippet = String::from_utf8_lossy(&raw);
        let snippet: String = snippet.chars().take(180).collect();
        return Err(ApiError {
            status: status.as_u16(),
            url: url.to_string(),
            message: format!("upstream responded HTTP {}: {}", status.as_u16(), snippet),
        });
    }

    let body: Value = serde_json::from_slice(&raw).map_err(|e| ApiError {
        status: status.as_u16(),
        url: url.to_string(),
        message: format!("invalid JSON payload: {e}"),
    })?;

    let latency_ms = started.elapsed().as_millis() as u64;
    state.cache_put(
        url.to_string(),
        CacheEntry {
            fetched_at: Instant::now(),
            body: body.clone(),
            latency_ms,
            bytes,
        },
    );

    Ok(ApiEnvelope {
        url: url.to_string(),
        body,
        latency_ms,
        bytes,
        cache_age_ms: 0,
        cached: false,
        status: status.as_u16(),
    })
}

fn describe_reqwest_error(err: &reqwest::Error) -> String {
    if err.is_timeout() {
        "upstream request timed out after 25s".to_string()
    } else if err.is_connect() {
        format!("connection failed: {err}")
    } else {
        format!("request failed: {err}")
    }
}

#[tauri::command]
async fn fetch_weeks(
    force: Option<bool>,
    state: State<'_, ApiState>,
) -> Result<ApiEnvelope, ApiError> {
    get_json(&state, &format!("{API_BASE}/api/weeks"), force.unwrap_or(false)).await
}

#[tauri::command]
async fn fetch_feed(
    kind: String,
    period: String,
    force: Option<bool>,
    state: State<'_, ApiState>,
) -> Result<ApiEnvelope, ApiError> {
    let url = format!("{API_BASE}/api/{kind}/{period}");

    if !FEED_KINDS.contains(&kind.as_str()) {
        return Err(ApiError {
            status: 400,
            url,
            message: format!(
                "unknown feed kind '{kind}' (expected one of: {})",
                FEED_KINDS.join(", ")
            ),
        });
    }

    let trimmed = period.trim();
    let plausible = trimmed.starts_with(|c: char| c.is_ascii_digit())
        && !trimmed.contains(' ')
        && trimmed.len() <= 16;
    if !plausible {
        return Err(ApiError {
            status: 400,
            url,
            message: format!(
                "invalid periodId '{trimmed}' — expected YYYY-MM-DD (daily) or YYYY-kwWW (weekly)"
            ),
        });
    }

    get_json(&state, &url, force.unwrap_or(false)).await
}

#[tauri::command]
fn invalidate_cache(state: State<'_, ApiState>) -> usize {
    match state.cache.lock() {
        Ok(mut cache) => {
            let len = cache.len();
            cache.clear();
            len
        }
        Err(_) => 0,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(ApiState::new()?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_weeks,
            fetch_feed,
            invalidate_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cyber Slate Intelligence");
}
