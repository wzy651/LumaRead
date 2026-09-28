//! Credentials are never returned to the WebView. Windows DPAPI binds ciphertext
//! to the current Windows user; other platforms deliberately have no plaintext fallback.
use serde::{Deserialize, Serialize};
use std::{path::{Path, PathBuf}, sync::Mutex};
use tauri::{Manager, State};

#[derive(Default)]
pub struct CredentialAccess(Mutex<()>);

#[derive(Serialize, Deserialize)]
struct Credential { endpoint: String, key: String }

fn canonical(endpoint: &str) -> Result<String, String> {
    Ok(crate::reading_context::validate_endpoint(endpoint)?.to_string())
}

fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_local_data_dir().map(|dir| dir.join("reading-credential.dpapi"))
        .map_err(|_| "无法打开应用的安全凭据目录。".into())
}

#[cfg(windows)]
fn crypt(input: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use windows::{core::PCWSTR, Win32::{Foundation::{HLOCAL, LocalFree}, Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN}}};
    let data = CRYPT_INTEGER_BLOB { cbData: input.len() as u32, pbData: input.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        let result = if encrypt {
            CryptProtectData(&data, PCWSTR::null(), None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output)
        } else {
            CryptUnprotectData(&data, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output)
        };
        result.map_err(|_| "Windows 无法保护或读取此凭据，请重新填写密钥。".to_string())?;
        let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        std::ptr::write_bytes(output.pbData, 0, output.cbData as usize);
        let _ = LocalFree(Some(HLOCAL(output.pbData as *mut _)));
        Ok(bytes)
    }
}
#[cfg(not(windows))]
fn crypt(_: &[u8], _: bool) -> Result<Vec<u8>, String> { Err("此平台暂不支持安全记住密钥，请使用会话密钥。".into()) }

fn save_at(file: &Path, endpoint: &str, key: &str) -> Result<(), String> {
    if key.trim().is_empty() || key.len() > 4096 || key.contains(['\r', '\n']) { return Err("密钥为空或格式不正确。".into()); }
    let credential = Credential { endpoint: canonical(endpoint)?, key: key.trim().into() };
    let mut plain = serde_json::to_vec(&credential).map_err(|_| "无法保存凭据。")?;
    let encrypted = crypt(&plain, true); plain.fill(0);
    let encrypted = encrypted?;
    let parent = file.parent().ok_or("凭据路径无效。")?;
    std::fs::create_dir_all(parent).map_err(|_| "无法创建凭据目录。")?;
    let temp = file.with_extension("pending");
    use std::io::Write;
    let result = (|| -> std::io::Result<()> {
        let mut out = std::fs::File::create(&temp)?;
        out.write_all(&encrypted)?; out.sync_all()?; drop(out);
        std::fs::rename(&temp, file)
    })();
    if result.is_err() { let _ = std::fs::remove_file(&temp); }
    result.map_err(|_| "未能安全保存密钥；本次会话仍可使用。".into())
}

fn read_at(file: &Path, endpoint: &str) -> Result<Option<String>, String> {
    let endpoint = canonical(endpoint)?;
    if !file.exists() { return Ok(None); }
    if std::fs::metadata(file).map_err(|_| "无法读取凭据。")?.len() > 20_000 { return Err("凭据文件无效，请重新保存。".into()); }
    let encrypted = std::fs::read(file).map_err(|_| "无法读取凭据。")?;
    let mut plain = crypt(&encrypted, false)?;
    let credential = serde_json::from_slice::<Credential>(&plain); plain.fill(0);
    let credential = credential.map_err(|_| "凭据文件无效，请重新保存。")?;
    Ok((credential.endpoint == endpoint).then_some(credential.key))
}

pub fn key_for(app: &tauri::AppHandle, endpoint: &str, access: &CredentialAccess) -> Result<Option<String>, String> {
    let _guard = access.0.lock().map_err(|_| "凭据暂时忙碌，请重试。")?;
    read_at(&path(app)?, endpoint)
}

#[tauri::command]
pub fn reading_credential_status(app: tauri::AppHandle, endpoint: String, access: State<'_, CredentialAccess>) -> Result<bool, String> {
    Ok(key_for(&app, &endpoint, &access)?.is_some())
}
#[tauri::command]
pub fn save_reading_credential(app: tauri::AppHandle, endpoint: String, api_key: String, access: State<'_, CredentialAccess>) -> Result<(), String> {
    let _guard = access.0.lock().map_err(|_| "凭据暂时忙碌，请重试。")?;
    save_at(&path(&app)?, &endpoint, &api_key)
}
#[tauri::command]
pub fn clear_reading_credential(app: tauri::AppHandle, access: State<'_, CredentialAccess>) -> Result<(), String> {
    let _guard = access.0.lock().map_err(|_| "凭据暂时忙碌，请重试。")?;
    let file = path(&app)?;
    match std::fs::remove_file(file) { Ok(()) => Ok(()), Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()), Err(_) => Err("无法清除已保存的密钥，请重试。".into()) }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn encrypted_restart_binding_replacement_and_corruption() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.qa-artifacts/credentials-test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(format!("{}.dpapi", std::process::id()));
        let endpoint = "https://api.example.test/chat/completions";
        save_at(&file, endpoint, "fixture-secret-only").unwrap();
        let bytes = std::fs::read(&file).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("fixture-secret-only"));
        assert_eq!(read_at(&file, endpoint).unwrap().as_deref(), Some("fixture-secret-only"));
        assert!(read_at(&file, "https://other.example.test/chat/completions").unwrap().is_none());
        save_at(&file, endpoint, "replacement-fixture").unwrap();
        assert_eq!(read_at(&file, endpoint).unwrap().as_deref(), Some("replacement-fixture"));
        std::fs::write(&file, b"corrupt").unwrap(); assert!(read_at(&file, endpoint).is_err());
        std::fs::remove_file(file).unwrap();
    }
}
