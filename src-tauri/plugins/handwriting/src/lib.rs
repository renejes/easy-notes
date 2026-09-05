use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
use tauri::Manager;

#[cfg(target_os = "ios")]
mod mobile;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognizeRequest {
    pub png_path: String,
    pub strokes: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecognizeReply {
    pub text: String,
    pub engine: String,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("handwriting")
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            {
                let plugin = mobile::init(app, api)?;
                app.manage(plugin);
            }
            #[cfg(not(target_os = "ios"))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}

#[cfg(target_os = "ios")]
pub async fn recognize_handwriting<R: Runtime>(
    app: &AppHandle<R>,
    request: RecognizeRequest,
) -> Result<RecognizeReply, String> {
    app.state::<mobile::Handwriting<R>>()
        .recognize_handwriting(request)
        .await
}

#[cfg(not(target_os = "ios"))]
pub async fn recognize_handwriting<R: Runtime>(
    _app: &AppHandle<R>,
    _request: RecognizeRequest,
) -> Result<RecognizeReply, String> {
    Err("iPad handwriting recognition is only available on iOS.".into())
}
