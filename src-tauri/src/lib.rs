mod models;

use base64::{engine::general_purpose, Engine as _};
use ort::session::Session;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

struct CatalogEntry {
    id: &'static str,
    name: &'static str,
    filename: &'static str,
    url: Option<&'static str>,
}

const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "pp-formulanet_plus-l",
        name: "PP-FormulaNet Plus L",
        filename: "pp-formulanet_plus-l.onnx",
        url: None,
    },
    CatalogEntry {
        id: "unimernet",
        name: "UniMERNet",
        filename: "unimernet.onnx",
        url: Some("https://github.com/GreatV/oar-ocr/releases/download/v0.3.0/unimernet.onnx"),
    },
];

#[derive(serde::Serialize)]
struct ModelInfo {
    id: String,
    name: String,
    available: bool,
    downloadable: bool,
}

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    id: String,
    downloaded: u64,
    total: Option<u64>,
}

pub struct ModelRegistry {
    pub sessions: Mutex<HashMap<String, Session>>,
    pub models_dir: PathBuf,
    pub tokenizer_path: PathBuf,
}

#[tauri::command]
fn read_clipboard_image(app: tauri::AppHandle) -> Result<String, String> {
    let image = app.clipboard().read_image().map_err(|e| e.to_string())?;
    let rgba = image.rgba().to_vec();
    let w = image.width();
    let h = image.height();

    let mut png_bytes: Vec<u8> = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_bytes, w, h);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(&rgba).map_err(|e| e.to_string())?;
    }

    Ok(general_purpose::STANDARD.encode(&png_bytes))
}

#[tauri::command]
fn save_temp_image(base64_data: String) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| e.to_string())?;

    let mut path = std::env::temp_dir();
    path.push("latex_convert.png");

    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_models(state: tauri::State<ModelRegistry>) -> Vec<ModelInfo> {
    CATALOG
        .iter()
        .map(|entry| {
            let available = if entry.url.is_none() {
                true
            } else {
                state.models_dir.join(entry.filename).exists()
            };
            ModelInfo {
                id: entry.id.to_string(),
                name: entry.name.to_string(),
                available,
                downloadable: entry.url.is_some(),
            }
        })
        .collect()
}

#[tauri::command]
async fn download_model(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, ModelRegistry>,
) -> Result<(), String> {
    let entry = CATALOG
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| format!("Unknown model: {}", id))?;
    let url = entry
        .url
        .ok_or_else(|| "Model is bundled, no download needed".to_string())?;

    let dest = state.models_dir.join(entry.filename);

    let mut response = ureq::get(url).call().map_err(|e| e.to_string())?;

    let total = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok());

    let mut file = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
    let mut reader = response.body_mut().as_reader();
    let mut buf = [0u8; 65536];
    let mut downloaded = 0u64;

    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        downloaded += n as u64;
        app.emit(
            "download-progress",
            DownloadProgress {
                id: id.clone(),
                downloaded,
                total,
            },
        )
        .ok();
    }

    let session = Session::builder()
        .map_err(|e| e.to_string())?
        .commit_from_file(&dest)
        .map_err(|e| e.to_string())?;

    state.sessions.lock().unwrap().insert(id, session);

    Ok(())
}

#[tauri::command]
fn delete_model(id: String, state: tauri::State<ModelRegistry>) -> Result<(), String> {
    let entry = CATALOG
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| format!("Unknown model: {}", id))?;

    if entry.url.is_none() {
        return Err("Cannot delete a bundled model".to_string());
    }

    let path = state.models_dir.join(entry.filename);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    state.sessions.lock().unwrap().remove(&id);

    Ok(())
}

#[tauri::command]
fn convert(
    model_id: String,
    image_path: String,
    state: tauri::State<ModelRegistry>,
) -> Result<String, String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&model_id)
        .ok_or_else(|| format!("Model not loaded: {}", model_id))?;

    match model_id.as_str() {
        "pp-formulanet_plus-l" => models::ppformulanet(
            session,
            &image_path,
            state.tokenizer_path.to_str().unwrap_or(""),
        ),
        "unimernet" => models::unimernet(
            session,
            &image_path,
            state.tokenizer_path.to_str().unwrap_or(""),
        ),
        _ => Err(format!("Unknown model: {}", model_id)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let bundled_model_path = app.path().resolve(
                "models/pp-formulanet_plus-l.onnx",
                tauri::path::BaseDirectory::Resource,
            )?;

            let tokenizer_path = app.path().resolve(
                "models/unimernet_tokenizer.json",
                tauri::path::BaseDirectory::Resource,
            )?;

            let models_dir = app.path().app_data_dir()?.join("models");
            std::fs::create_dir_all(&models_dir)?;

            let session = Session::builder()?.commit_from_file(&bundled_model_path)?;
            let mut sessions = HashMap::new();
            sessions.insert("pp-formulanet_plus-l".to_string(), session);

            for entry in CATALOG.iter().filter(|e| e.url.is_some()) {
                let path = models_dir.join(entry.filename);
                if path.exists() {
                    if let Ok(s) = Session::builder().and_then(|mut b| b.commit_from_file(&path)) {
                        sessions.insert(entry.id.to_string(), s);
                    }
                }
            }

            app.manage(ModelRegistry {
                sessions: Mutex::new(sessions),
                models_dir,
                tokenizer_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_clipboard_image,
            save_temp_image,
            get_models,
            download_model,
            delete_model,
            convert,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
