use tauri_plugin_clipboard_manager::ClipboardExt;
use base64::{engine::general_purpose, Engine as _};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![read_clipboard_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
