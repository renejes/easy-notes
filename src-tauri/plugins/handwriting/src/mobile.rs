use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{RecognizeReply, RecognizeRequest};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_handwriting);

pub struct Handwriting<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<Handwriting<R>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "ios")]
    {
        let handle = api.register_ios_plugin(init_plugin_handwriting)?;
        return Ok(Handwriting(handle));
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = api;
        Err("Handwriting is iOS-only.".into())
    }
}

impl<R: Runtime> Handwriting<R> {
    pub async fn recognize_handwriting(
        &self,
        request: RecognizeRequest,
    ) -> Result<RecognizeReply, String> {
        self.0
            .run_mobile_plugin_async("recognizeHandwriting", request)
            .await
            .map_err(|error| error.to_string())
    }
}
