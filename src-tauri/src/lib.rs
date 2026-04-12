mod models;

use base64::{engine::general_purpose, Engine as _};
use ort::session::Session;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

const MODEL_ENCODER_URL: &str =
    "https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/encoder_model.onnx?download=true";
const MODEL_DECODER_URL: &str =
    "https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/decoder_model.onnx?download=true";
const MODEL_TOKENIZER_URL: &str =
    "https://huggingface.co/breezedeus/pix2text-mfr-1.5/resolve/main/tokenizer.json?download=true";

pub struct ModelRegistry {
    pub encoder: Mutex<Option<Session>>,
    pub decoder: Mutex<Option<Session>>,
    pub tokenizer_path: Mutex<Option<PathBuf>>,
}

fn models_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models"))
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
async fn convert_gemini(base64: String, api_key: String, model: String) -> Result<String, String> {
    models::gemini_convert(&base64, &api_key, &model)
}

#[tauri::command]
async fn convert(
    image_path: String,
    state: tauri::State<'_, ModelRegistry>,
) -> Result<String, String> {
    let encoder = state.encoder.lock().unwrap().take().ok_or("Model not loaded.")?;
    let decoder = state.decoder.lock().unwrap().take().ok_or("Model not loaded.")?;
    let tokenizer_path = state
        .tokenizer_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Tokenizer path not set.")?;

    let (result, encoder, decoder) = tauri::async_runtime::spawn_blocking(move || {
        let mut encoder = encoder;
        let mut decoder = decoder;
        let res = models::pix2text_mfr(
            &mut encoder,
            &mut decoder,
            &image_path,
            tokenizer_path.to_str().unwrap_or(""),
        );
        (res, encoder, decoder)
    })
    .await
    .map_err(|e| e.to_string())?;

    *state.encoder.lock().unwrap() = Some(encoder);
    *state.decoder.lock().unwrap() = Some(decoder);

    result
}

#[tauri::command]
fn check_pix2text_downloaded(app: tauri::AppHandle) -> bool {
    let Ok(dir) = models_dir(&app) else {
        return false;
    };
    dir.join("pix2text-mfr-1.5-encoder.onnx").exists()
        && dir.join("pix2text-mfr-1.5-decoder.onnx").exists()
        && dir.join("pix2text-mfr-1.5-tokenizer.json").exists()
}

#[tauri::command]
async fn load_pix2text_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, ModelRegistry>,
) -> Result<(), String> {
    let dir = models_dir(&app)?;
    let tokenizer_path = dir.join("pix2text-mfr-1.5-tokenizer.json");

    let (encoder, decoder) =
        tauri::async_runtime::spawn_blocking(move || -> Result<_, String> {
            let encoder = Session::builder()
                .map_err(|e| e.to_string())?
                .commit_from_file(dir.join("pix2text-mfr-1.5-encoder.onnx"))
                .map_err(|e| e.to_string())?;
            let decoder = Session::builder()
                .map_err(|e| e.to_string())?
                .commit_from_file(dir.join("pix2text-mfr-1.5-decoder.onnx"))
                .map_err(|e| e.to_string())?;
            Ok((encoder, decoder))
        })
        .await
        .map_err(|e| e.to_string())??;

    *state.encoder.lock().unwrap() = Some(encoder);
    *state.decoder.lock().unwrap() = Some(decoder);
    *state.tokenizer_path.lock().unwrap() = Some(tokenizer_path);

    Ok(())
}

#[tauri::command]
async fn download_pix2text(app: tauri::AppHandle) -> Result<(), String> {
    let dir = models_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let files = [
            ("pix2text-mfr-1.5-encoder.onnx", MODEL_ENCODER_URL),
            ("pix2text-mfr-1.5-decoder.onnx", MODEL_DECODER_URL),
            ("pix2text-mfr-1.5-tokenizer.json", MODEL_TOKENIZER_URL),
        ];

        let agent = ureq::config::Config::builder()
            .timeout_connect(Some(std::time::Duration::from_secs(30)))
            .timeout_global(Some(std::time::Duration::from_secs(600)))
            .build()
            .new_agent();

        for (filename, url) in &files {
            let dest = dir.join(filename);
            if dest.exists() {
                continue;
            }

            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "file": filename,
                    "progress": 0,
                    "downloaded": 0,
                    "total": 0,
                    "status": "connecting",
                }),
            );

            let tmp = dir.join(format!("{}.tmp", filename));

            let mut response = agent.get(*url).call().map_err(|e| match e {
                ureq::Error::HostNotFound | ureq::Error::Io(_) => {
                    "No internet connection".to_string()
                }
                other => other.to_string(),
            })?;

            let total: u64 = response
                .headers()
                .get("content-length")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);

            let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
            let mut downloaded: u64 = 0;
            let mut buf = vec![0u8; 65536];
            let mut reader = response.body_mut().as_reader();

            loop {
                let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
                downloaded += n as u64;

                let progress = if total > 0 {
                    (downloaded as f64 / total as f64 * 100.0) as u32
                } else {
                    0
                };
                let _ = app.emit(
                    "download-progress",
                    serde_json::json!({
                        "file": filename,
                        "progress": progress,
                        "downloaded": downloaded,
                        "total": total,
                    }),
                );
            }

            std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn delete_pix2text_model(
    app: tauri::AppHandle,
    state: tauri::State<ModelRegistry>,
) -> Result<(), String> {
    *state.encoder.lock().unwrap() = None;
    *state.decoder.lock().unwrap() = None;
    *state.tokenizer_path.lock().unwrap() = None;

    let dir = models_dir(&app)?;
    for filename in &[
        "pix2text-mfr-1.5-encoder.onnx",
        "pix2text-mfr-1.5-decoder.onnx",
        "pix2text-mfr-1.5-tokenizer.json",
    ] {
        let path = dir.join(filename);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            app.manage(ModelRegistry {
                encoder: Mutex::new(None),
                decoder: Mutex::new(None),
                tokenizer_path: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_clipboard_image,
            save_temp_image,
            convert,
            convert_gemini,
            check_pix2text_downloaded,
            download_pix2text,
            load_pix2text_model,
            delete_pix2text_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
