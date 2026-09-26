mod reading_context;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(reading_context::ContextRequests::default())
        .invoke_handler(tauri::generate_handler![reading_context::request_reading_context, reading_context::cancel_context_request])
        .run(tauri::generate_context!())
        .expect("error while running LumaRead");
}
