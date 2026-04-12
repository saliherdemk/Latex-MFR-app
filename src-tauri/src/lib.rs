mod models;

use base64::{engine::general_purpose, Engine as _};
use ort::session::Session;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ModelRegistry {
    pub encoder: Mutex<Session>,
    pub decoder: Mutex<Session>,
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
async fn convert_gemini(base64: String, api_key: String) -> Result<String, String> {
    models::gemini_convert(&base64, &api_key)
}

#[tauri::command]
fn convert(image_path: String, state: tauri::State<ModelRegistry>) -> Result<String, String> {
    let mut encoder = state.encoder.lock().unwrap();
    let mut decoder = state.decoder.lock().unwrap();
    models::pix2text_mfr(
        &mut encoder,
        &mut decoder,
        &image_path,
        state.tokenizer_path.to_str().unwrap_or(""),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let resolve = |name: &str| {
                app.path()
                    .resolve(name, tauri::path::BaseDirectory::Resource)
            };

            let encoder_path = resolve("models/pix2text-mfr-1.5-encoder.onnx")?;
            let decoder_path = resolve("models/pix2text-mfr-1.5-decoder.onnx")?;
            let tokenizer_path = resolve("models/pix2text-mfr-1.5-tokenizer.json")?;

            let encoder = Session::builder()?.commit_from_file(&encoder_path)?;
            let decoder = Session::builder()?.commit_from_file(&decoder_path)?;

            app.manage(ModelRegistry {
                encoder: Mutex::new(encoder),
                decoder: Mutex::new(decoder),
                tokenizer_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_clipboard_image,
            save_temp_image,
            convert,
            convert_gemini,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
