mod reading_context;
mod reading_speech;
mod reading_credentials;
#[cfg(target_os = "android")]
mod mobile_reading;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "android")]
    let builder = builder.plugin(mobile_reading::init());
    #[cfg(not(target_os = "android"))]
    let builder = builder
        .manage(reading_context::ContextRequests::default())
        .manage(reading_speech::ReadingSpeech::default())
        .manage(reading_credentials::CredentialAccess::default());
    builder
        .invoke_handler(tauri::generate_handler![reading_context::request_reading_context, reading_context::cancel_context_request, reading_speech::speak_reading_text, reading_speech::cancel_reading_speech, reading_credentials::reading_credential_status, reading_credentials::save_reading_credential, reading_credentials::clear_reading_credential, close_mobile_app])
        .run(tauri::generate_context!())
        .expect("error while running LumaRead");
}

#[tauri::command]
async fn close_mobile_app(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    { mobile_reading::close_mobile_app(app).await }
    #[cfg(not(target_os = "android"))]
    { let _ = app; Err("Only available on Android.".into()) }
}
