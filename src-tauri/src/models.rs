use image::imageops::FilterType;
use ort::session::Session;
use std::collections::HashMap;

const PP_INPUT_SIZE: usize = 768;
const UNI_INPUT_SIZE: usize = 192;

fn load_and_resize(image_path: &str, width: u32, height: u32) -> Result<Vec<f32>, String> {
    let img = image::open(image_path)
        .map_err(|e| e.to_string())?
        .resize_exact(width, height, FilterType::Lanczos3)
        .to_rgb8();

    let data = img
        .pixels()
        .flat_map(|p| {
            [
                p[0] as f32 / 255.0,
                p[1] as f32 / 255.0,
                p[2] as f32 / 255.0,
            ]
        })
        .collect();

    Ok(data)
}

pub fn ppformulanet(
    session: &mut Session,
    image_path: &str,
    tokenizer_path: &str,
) -> Result<String, String> {
    let img = image::open(image_path)
        .map_err(|e| e.to_string())?
        .resize_exact(
            PP_INPUT_SIZE as u32,
            PP_INPUT_SIZE as u32,
            FilterType::Lanczos3,
        )
        .to_luma8();

    let pixels: Vec<f32> = img.pixels().map(|p| p[0] as f32 / 255.0).collect();

    let input = ort::value::Tensor::<f32>::from_array((
        [1, 1, PP_INPUT_SIZE, PP_INPUT_SIZE],
        pixels.into_boxed_slice(),
    ))
    .map_err(|e| e.to_string())?;

    let outputs = session
        .run(ort::inputs![input])
        .map_err(|e| e.to_string())?;

    let first = outputs.iter().next().ok_or("No outputs from model")?;
    let (_, data) = first
        .1
        .try_extract_tensor::<i64>()
        .map_err(|e| e.to_string())?;
    let tokens: Vec<i64> = data.iter().cloned().collect();
    decode_tokens(&tokens, tokenizer_path)
}

pub fn unimernet(
    session: &mut Session,
    image_path: &str,
    tokenizer_path: &str,
) -> Result<String, String> {
    let img = image::open(image_path)
        .map_err(|e| e.to_string())?
        .resize_exact(672, UNI_INPUT_SIZE as u32, FilterType::Lanczos3)
        .to_luma8();

    let pixels: Vec<f32> = img.pixels().map(|p| p[0] as f32 / 255.0).collect();

    let input = ort::value::Tensor::<f32>::from_array((
        [1, 1, UNI_INPUT_SIZE, 672],
        pixels.into_boxed_slice(),
    ))
    .map_err(|e| e.to_string())?;

    let outputs = session
        .run(ort::inputs![input])
        .map_err(|e| e.to_string())?;

    let first = outputs.iter().next().ok_or("No outputs from model")?;
    let (_, data) = first
        .1
        .try_extract_tensor::<i64>()
        .map_err(|e| e.to_string())?;
    let tokens: Vec<i64> = data.iter().cloned().collect();
    decode_tokens(&tokens, tokenizer_path)
}

pub fn decode_tokens(tokens: &[i64], tokenizer_path: &str) -> Result<String, String> {
    let file = std::fs::read_to_string(tokenizer_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&file).map_err(|e| e.to_string())?;

    let vocab = json["model"]["vocab"]
        .as_object()
        .ok_or("Could not find model.vocab in tokenizer.json")?;

    let id_to_token: HashMap<i64, &str> = vocab
        .iter()
        .filter_map(|(token, id)| id.as_i64().map(|i| (i, token.as_str())))
        .collect();

    let result = tokens
        .iter()
        .filter(|&&id| id > 22) // skip special tokens (0–22)
        .filter_map(|id| id_to_token.get(id).copied())
        .collect::<Vec<&str>>()
        .join("")
        .replace('\u{0120}', ""); // Ġ = byte-level space prefix

    Ok(result)
}
