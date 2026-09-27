mod reading_context;
mod reading_speech;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(reading_context::ContextRequests::default())
        .manage(reading_speech::ReadingSpeech::default())
        .invoke_handler(tauri::generate_handler![reading_context::request_reading_context, reading_context::cancel_context_request, reading_speech::speak_reading_text, reading_speech::cancel_reading_speech])
        .run(tauri::generate_context!())
        .expect("error while running LumaRead");
}
