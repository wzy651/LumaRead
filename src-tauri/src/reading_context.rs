#[cfg(not(target_os = "android"))]
use std::{collections::HashMap, sync::Mutex, time::Duration};
use serde::{Deserialize, Serialize};
#[cfg(not(target_os = "android"))]
use tauri::State;

#[derive(Default)]
#[cfg(not(target_os = "android"))]
pub struct ContextRequests(Mutex<HashMap<String, tokio::task::AbortHandle>>);

#[derive(Deserialize, Serialize)]
pub struct ContextResponse { status: u16, body: String }

pub(crate) fn validate_endpoint(endpoint: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(endpoint).map_err(|_| "Invalid service address.")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]" | "::1"));
    if !(url.scheme() == "https" || (url.scheme() == "http" && local))
        || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some()
        || url.query().is_some() || url.fragment().is_some()
        || !(url.path().ends_with("/chat/completions") || url.path().ends_with("/api/chat")) {
        return Err("Use an HTTPS model endpoint, or HTTP on localhost.".into());
    }
    Ok(url)
}

#[cfg(not(target_os = "android"))]
async fn send_model_request(url: reqwest::Url, api_key: String, payload: serde_json::Value) -> Result<ContextResponse, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(60)).connect_timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none()).build().map_err(|_| "Could not initialize the model connection.")?;
    let mut request = client.post(url).json(&payload);
    if !api_key.is_empty() { request = request.bearer_auth(api_key); }
    let mut response = request.send().await.map_err(|error| if error.is_timeout() { "context-timeout" } else { "context-network" })?;
    let status = response.status().as_u16();
    if !(200..300).contains(&status) { return Ok(ContextResponse { status, body: String::new() }); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "解释响应中断，请重试。")? {
        if bytes.len() + chunk.len() > 100_000 { return Err("解释响应过长，请重试。".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8(bytes).map_err(|_| "解释响应编码无效。")?;
    Ok(ContextResponse { status, body })
}

// A bounded model-only transport. It never writes credentials or reading text to disk.
#[tauri::command]
#[cfg(not(target_os = "android"))]
pub async fn request_reading_context(app: tauri::AppHandle, request_id: String, endpoint: String, api_key: String, body: String, requests: State<'_, ContextRequests>, credentials: State<'_, crate::reading_credentials::CredentialAccess>) -> Result<ContextResponse, String> {
    if request_id.is_empty() || request_id.len() > 80 || body.len() > 24_000 || api_key.len() > 4096 || api_key.contains(['\r', '\n']) {
        return Err("Invalid or oversized reading request.".into());
    }
    let url = validate_endpoint(&endpoint)?;
    let api_key = if api_key.is_empty() && !url.path().ends_with("/api/chat") {
        crate::reading_credentials::key_for(&app, &endpoint, &credentials)?.unwrap_or_default()
    } else { api_key };
    let payload: serde_json::Value = serde_json::from_str(&body).map_err(|_| "Invalid request format.")?;
    if !payload["model"].is_string() || !payload["messages"].is_array() || payload["stream"] != false {
        return Err("Only non-streaming model requests are supported.".into());
    }
    let task = {
        let mut active = requests.0.lock().map_err(|_| "The model service is busy.")?;
        if active.len() >= 4 || active.contains_key(&request_id) { return Err("Too many model requests. Please wait.".into()); }
        let task = tokio::spawn(send_model_request(url, api_key, payload));
        active.insert(request_id.clone(), task.abort_handle());
        task
    };
    let result = task.await.map_err(|_| "解释请求已取消。".to_string());
    if let Ok(mut active) = requests.0.lock() { active.remove(&request_id); }
    result?
}

#[tauri::command]
#[cfg(not(target_os = "android"))]
pub fn cancel_context_request(request_id: String, requests: State<'_, ContextRequests>) {
    if let Ok(mut active) = requests.0.lock() { if let Some(task) = active.remove(&request_id) { task.abort(); } }
}

#[cfg(target_os = "android")]
#[tauri::command]
pub async fn request_reading_context(app: tauri::AppHandle, request_id: String, endpoint: String, api_key: String, body: String) -> Result<ContextResponse, String> {
    let endpoint = validate_endpoint(&endpoint)?.to_string();
    crate::mobile_reading::call(&app, "requestContext", serde_json::json!({ "requestId": request_id, "endpoint": endpoint, "apiKey": api_key, "body": body })).await
}
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn cancel_context_request(app: tauri::AppHandle, request_id: String) -> Result<(), String> {
    crate::mobile_reading::call(&app, "cancelContext", serde_json::json!({ "requestId": request_id })).await
}

#[cfg(all(test, not(target_os = "android")))]
mod tests {
    use super::{send_model_request, validate_endpoint, ContextResponse};
    use std::{io::{Read, Write}, net::TcpListener, thread, time::Duration};

    fn exchange(status: &str, response_body: &str, extra_headers: &str, key: &str) -> (Result<ContextResponse, String>, String) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let response = format!("HTTP/1.1 {status}\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n{extra_headers}\r\n{response_body}", response_body.len());
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut received = Vec::new(); let mut buffer = [0u8; 4096];
            loop {
                let count = stream.read(&mut buffer).unwrap(); if count == 0 { break }
                received.extend_from_slice(&buffer[..count]);
                let text = String::from_utf8_lossy(&received);
                if let Some(end) = text.find("\r\n\r\n") {
                    let size: usize = text[..end].lines().find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length: ").map(|s| s.parse().unwrap())).unwrap_or(0);
                    if received.len() >= end + 4 + size { break }
                }
            }
            let _ = stream.write_all(response.as_bytes());
            String::from_utf8(received).unwrap()
        });
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let payload = serde_json::json!({"model":"test-fixture", "stream":false, "messages":[{"role":"user","content":"A test sentence."}]});
        let result = runtime.block_on(send_model_request(validate_endpoint(&format!("http://{address}/v1/chat/completions")).unwrap(), key.into(), payload));
        (result, server.join().unwrap())
    }
    #[test]
    fn endpoint_boundaries() {
        assert!(validate_endpoint("https://api.example.com/v1/chat/completions").is_ok());
        assert!(validate_endpoint("http://127.0.0.1:11434/api/chat").is_ok());
        for endpoint in ["http://example.com/chat/completions", "file:///etc/passwd", "https://user:secret@example.com/chat/completions", "https://example.com/chat/completions?key=secret", "https://example.com/other"] { assert!(validate_endpoint(endpoint).is_err()); }
    }
    #[test]
    fn native_transport_posts_to_local_fixture_and_decodes_unicode() {
        let body = r#"{"choices":[{"message":{"content":"这里是河岸。"}}]}"#;
        let (response, request) = exchange("200 OK", body, "", "fixture-only");
        let response = response.unwrap(); assert_eq!(response.status, 200); assert_eq!(response.body, body);
        assert!(request.starts_with("POST /v1/chat/completions HTTP/1.1"));
        assert!(request.contains("Bearer fixture-only")); assert!(request.contains("A test sentence."));
    }
    #[test]
    fn error_responses_do_not_expose_server_details() {
        let (response, request) = exchange("401 Unauthorized", "sensitive-server-details", "", "");
        let response = response.unwrap(); assert_eq!(response.status, 401); assert!(response.body.is_empty());
        assert!(!request.to_ascii_lowercase().contains("authorization:"));
    }
    #[test]
    fn redirects_are_not_followed() {
        let (response, _) = exchange("302 Found", "", "Location: http://127.0.0.1:9/untrusted\r\n", "fixture-only");
        assert_eq!(response.unwrap().status, 302);
    }
    #[test]
    fn oversized_response_is_rejected() {
        let (response, _) = exchange("200 OK", &"x".repeat(100_001), "", "");
        assert!(matches!(response, Err(message) if message.contains("过长")));
    }
}
