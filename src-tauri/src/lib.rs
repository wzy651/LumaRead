mod reading_context;
mod reading_speech;
mod reading_credentials;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(reading_context::ContextRequests::default())
        .manage(reading_speech::ReadingSpeech::default())
        .manage(reading_credentials::CredentialAccess::default())
        .invoke_handler(tauri::generate_handler![reading_context::request_reading_context, reading_context::cancel_context_request, reading_speech::speak_reading_text, reading_speech::cancel_reading_speech, reading_credentials::reading_credential_status, reading_credentials::save_reading_credential, reading_credentials::clear_reading_credential])
        .run(tauri::generate_context!())
        .expect("error while running LumaRead");
}
