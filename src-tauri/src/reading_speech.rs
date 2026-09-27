use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::State;

#[derive(Default)]
pub struct ReadingSpeech(Mutex<Option<(String, Arc<AtomicBool>)>>);

fn validate_text(id: &str, text: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 80
        || text.trim().is_empty()
        || text.chars().count() > 600
        || text.contains('\0')
    {
        return Err("speech-invalid-text".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn speak_reading_text(
    request_id: String,
    text: String,
    slow: bool,
    speech: State<'_, ReadingSpeech>,
) -> Result<(), String> {
    validate_text(&request_id, &text)?;
    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut active = speech.0.lock().map_err(|_| "speech-busy")?;
        if let Some((_, old)) = active.take() {
            old.store(true, Ordering::SeqCst);
        }
        *active = Some((request_id.clone(), cancelled.clone()));
    }
    // COM objects are created, used and released on the same worker thread.
    let result = tauri::async_runtime::spawn_blocking(move || play(&text, slow, &cancelled))
        .await
        .map_err(|_| "speech-unavailable".to_string());
    if let Ok(mut active) = speech.0.lock() {
        if active.as_ref().is_some_and(|(id, _)| *id == request_id) {
            active.take();
        }
    }
    result?
}

#[tauri::command]
pub fn cancel_reading_speech(request_id: String, speech: State<'_, ReadingSpeech>) {
    if let Ok(mut active) = speech.0.lock() {
        if active.as_ref().is_some_and(|(id, _)| *id == request_id) {
            if let Some((_, cancelled)) = active.take() {
                cancelled.store(true, Ordering::SeqCst);
            }
        }
    }
}

#[cfg(not(windows))]
fn play(_: &str, _: bool, _: &AtomicBool) -> Result<(), String> {
    Err("speech-unavailable".into())
}

#[cfg(windows)]
fn play(text: &str, slow: bool, cancelled: &AtomicBool) -> Result<(), String> {
    use std::{
        ptr,
        time::{Duration, Instant},
    };
    use windows::{
        core::{w, HSTRING, PCWSTR},
        Win32::{
            Media::Speech::{
                ISpObjectTokenCategory, ISpVoice, SpObjectTokenCategory, SpVoice, SPCAT_VOICES,
                SPF_ASYNC, SPF_IS_NOT_XML, SPF_PURGEBEFORESPEAK, SPRS_DONE, SPVOICESTATUS,
            },
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
            },
        },
    };
    // Serialize actual audio while allowing each superseded request to cancel.
    static AUDIO: Mutex<()> = Mutex::new(());
    let _audio = AUDIO.lock().map_err(|_| "speech-busy")?;
    if cancelled.load(Ordering::SeqCst) {
        return Ok(());
    }
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED)
            .ok()
            .map_err(|_| "speech-unavailable")?;
    }
    struct ComGuard;
    impl Drop for ComGuard {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    let _com = ComGuard;
    // Read existing voices only. Never install a voice, write registry settings,
    // interpret SSML, open files or send the selected text to a network service.
    unsafe {
        let voice: ISpVoice =
            CoCreateInstance(&SpVoice, None, CLSCTX_ALL).map_err(|_| "speech-unavailable")?;
        let category: ISpObjectTokenCategory =
            CoCreateInstance(&SpObjectTokenCategory, None, CLSCTX_ALL)
                .map_err(|_| "speech-unavailable")?;
        category
            .SetId(SPCAT_VOICES, false)
            .map_err(|_| "speech-no-english-voice")?;
        let mut found = false;
        for language in [
            w!("Language=409"),
            w!("Language=809"),
            w!("Language=C09"),
            w!("Language=1009"),
        ] {
            let tokens = category
                .EnumTokens(language, PCWSTR::null())
                .map_err(|_| "speech-no-english-voice")?;
            let mut count = 0;
            tokens
                .GetCount(&mut count)
                .map_err(|_| "speech-no-english-voice")?;
            if count > 0 {
                voice
                    .SetVoice(&tokens.Item(0).map_err(|_| "speech-no-english-voice")?)
                    .map_err(|_| "speech-unavailable")?;
                found = true;
                break;
            }
        }
        if !found {
            return Err("speech-no-english-voice".into());
        }
        voice
            .SetRate(if slow { -4 } else { -1 })
            .map_err(|_| "speech-unavailable")?;
        voice
            .Speak(
                &HSTRING::from(text),
                (SPF_ASYNC.0 | SPF_PURGEBEFORESPEAK.0 | SPF_IS_NOT_XML.0) as u32,
                None,
            )
            .map_err(|_| "speech-unavailable")?;
        let started = Instant::now();
        loop {
            if cancelled.load(Ordering::SeqCst) || started.elapsed() > Duration::from_secs(90) {
                voice
                    .Speak(
                        PCWSTR::null(),
                        (SPF_ASYNC.0 | SPF_PURGEBEFORESPEAK.0) as u32,
                        None,
                    )
                    .map_err(|_| "speech-unavailable")?;
                return if cancelled.load(Ordering::SeqCst) {
                    Ok(())
                } else {
                    Err("speech-timeout".into())
                };
            }
            voice.WaitUntilDone(50).map_err(|_| "speech-unavailable")?;
            let mut status = SPVOICESTATUS::default();
            voice
                .GetStatus(&mut status, ptr::null_mut())
                .map_err(|_| "speech-unavailable")?;
            if status.dwRunningState == SPRS_DONE.0 as u32 {
                return status
                    .hrLastResult
                    .ok()
                    .map_err(|_| "speech-unavailable".into());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_bounded_plain_text() {
        assert!(validate_text("test", "reluctantly").is_ok());
        assert!(validate_text("test", "<voice>not interpreted as XML</voice>").is_ok());
        for text in [
            String::new(),
            " ".into(),
            "x".repeat(601),
            "bad\0text".into(),
        ] {
            assert!(validate_text("test", &text).is_err());
        }
    }
    #[test]
    #[cfg(windows)]
    fn cancelled_speech_does_not_start_the_engine() {
        assert!(play("This must not play.", false, &AtomicBool::new(true)).is_ok());
    }
    #[test]
    #[cfg(windows)]
    #[ignore = "Audible Windows integration check; run explicitly on a machine with an English voice"]
    fn windows_english_pronunciation() {
        play("reluctantly", false, &AtomicBool::new(false)).unwrap();
        play("reluctantly", true, &AtomicBool::new(false)).unwrap();
    }
}
