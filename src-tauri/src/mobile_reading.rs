use serde::de::DeserializeOwned;
use tauri::{plugin::{Builder, PluginHandle, TauriPlugin}, Manager, Wry};

struct MobileReading(PluginHandle<Wry>);
pub fn init() -> TauriPlugin<Wry> {
    Builder::new("reading-mobile").setup(|app, api| {
        app.manage(MobileReading(api.register_android_plugin("com.lumaread.reader", "ReadingMobilePlugin")?));
        Ok(())
    }).build()
}
pub async fn call<T: DeserializeOwned>(app: &tauri::AppHandle, command: &str, payload: serde_json::Value) -> Result<T, String> {
    let handle = app.state::<MobileReading>();
    handle.0.run_mobile_plugin_async(command, payload).await.map_err(|error| {
        let message = error.to_string();
        ["context-timeout", "context-cancelled", "context-network", "context-busy", "speech-no-english-voice", "speech-cancelled", "speech-unavailable", "credential-unavailable", "credential-save-failed", "credential-clear-failed"]
            .into_iter().find(|code| message.contains(code)).unwrap_or("mobile-service-unavailable").to_string()
    })
}
pub async fn close_mobile_app(app: tauri::AppHandle) -> Result<(), String> {
    call(&app, "closeApp", serde_json::json!({})).await
}
