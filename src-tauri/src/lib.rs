mod ocr;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_handwriting::init())
        .plugin(tauri_plugin_scoped_storage::init())
        .invoke_handler(tauri::generate_handler![recognize_handwriting])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn recognize_handwriting(
    app: tauri::AppHandle,
    png_path: String,
    strokes: serde_json::Value,
) -> Result<ocr::RecognizeReply, String> {
    ocr::recognize(
        app,
        ocr::RecognizeArgs {
            png_path,
            strokes,
        },
    )
    .await
}
