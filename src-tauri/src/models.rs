use image::imageops::FilterType;
use ort::session::Session;
use std::collections::HashMap;

pub fn gemini_convert(base64: &str, api_key: &str) -> Result<String, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let body = serde_json::json!({
        "contents": [{
            "parts": [
                {
                    "text": "Convert the math formula in this image to LaTeX. Return only the raw LaTeX expression, no markdown, no code fences, no explanation, no $ delimiters."
                },
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": base64
                    }
                }
            ]
        }]
    });

    let json_bytes = serde_json::to_vec(&body).map_err(|e| e.to_string())?;

    let mut response = ureq::post(&url)
        .header("Content-Type", "application/json")
        .send(&json_bytes)
        .map_err(|e: ureq::Error| e.to_string())?;

    let data: serde_json::Value =
        serde_json::from_reader(response.body_mut().as_reader()).map_err(|e| e.to_string())?;

    data["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Unexpected Gemini response format".to_string())
}

const PIX2TEXT_INPUT_SIZE: u32 = 384;
const PIX2TEXT_BOS_TOKEN: i64 = 1;
const PIX2TEXT_EOS_TOKEN: i64 = 2;
const PIX2TEXT_MAX_NEW_TOKENS: usize = 1024;

pub fn pix2text_mfr(
    encoder_session: &mut Session,
    decoder_session: &mut Session,
    image_path: &str,
    tokenizer_path: &str,
) -> Result<String, String> {
    let img = image::open(image_path)
        .map_err(|e| e.to_string())?
        .resize_exact(
            PIX2TEXT_INPUT_SIZE,
            PIX2TEXT_INPUT_SIZE,
            FilterType::Lanczos3,
        )
        .to_rgb8();

    let num_pixels = (PIX2TEXT_INPUT_SIZE * PIX2TEXT_INPUT_SIZE) as usize;
    let mut pixel_values = vec![0f32; 3 * num_pixels];
    for (idx, pixel) in img.pixels().enumerate() {
        for c in 0..3usize {
            let val = pixel[c] as f32 / 255.0;
            pixel_values[c * num_pixels + idx] = (val - 0.5) / 0.5;
        }
    }

    let encoder_input = ort::value::Tensor::<f32>::from_array((
        [
            1usize,
            3,
            PIX2TEXT_INPUT_SIZE as usize,
            PIX2TEXT_INPUT_SIZE as usize,
        ],
        pixel_values.into_boxed_slice(),
    ))
    .map_err(|e| e.to_string())?;

    let encoder_outputs = encoder_session
        .run(ort::inputs!["pixel_values" => encoder_input])
        .map_err(|e| e.to_string())?;

    let first = encoder_outputs.iter().next().ok_or("No encoder output")?;
    let (enc_shape, enc_data) = first
        .1
        .try_extract_tensor::<f32>()
        .map_err(|e| e.to_string())?;
    let enc_seq_len = enc_shape[1] as usize;
    let enc_hidden_dim = enc_shape[2] as usize;
    let enc_data_vec: Vec<f32> = enc_data.iter().cloned().collect();
    drop(encoder_outputs);

    let mut generated: Vec<i64> = vec![PIX2TEXT_BOS_TOKEN];

    for _ in 0..PIX2TEXT_MAX_NEW_TOKENS {
        let seq_len = generated.len();

        let input_ids = ort::value::Tensor::<i64>::from_array((
            [1usize, seq_len],
            generated.clone().into_boxed_slice(),
        ))
        .map_err(|e| e.to_string())?;

        let encoder_hidden = ort::value::Tensor::<f32>::from_array((
            [1usize, enc_seq_len, enc_hidden_dim],
            enc_data_vec.clone().into_boxed_slice(),
        ))
        .map_err(|e| e.to_string())?;

        let decoder_outputs = decoder_session
            .run(ort::inputs![
                "input_ids" => input_ids,
                "encoder_hidden_states" => encoder_hidden
            ])
            .map_err(|e| e.to_string())?;

        let first = decoder_outputs.iter().next().ok_or("No decoder output")?;
        let (logits_shape, logits_data) = first
            .1
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;

        let vocab_size = logits_shape[2] as usize;
        let last_offset = (seq_len - 1) * vocab_size;
        let next_token = logits_data[last_offset..last_offset + vocab_size]
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i as i64)
            .ok_or("Empty logits")?;

        if next_token == PIX2TEXT_EOS_TOKEN {
            break;
        }
        generated.push(next_token);
    }

    pix2text_decode_tokens(&generated, tokenizer_path)
}

fn pix2text_decode_tokens(tokens: &[i64], tokenizer_path: &str) -> Result<String, String> {
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
        .filter(|&&id| id > 4) // skip special tokens: pad=0, bos=1, eos=2, unk=3, mask=4
        .filter_map(|id| id_to_token.get(id).copied())
        .collect::<Vec<&str>>()
        .join("")
        .replace('\u{0120}', " ") // Ġ = byte-level BPE space prefix
        .trim()
        .to_string();

    Ok(result)
}
