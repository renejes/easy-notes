//! On-device handwriting recognition. Vision on macOS; PencilKit/Vision on iPad.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognizeArgs {
    pub png_path: String,
    pub strokes: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognizeReply {
    pub text: String,
    pub engine: String,
}

pub async fn recognize(app: AppHandle, args: RecognizeArgs) -> Result<RecognizeReply, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = &args.strokes;
        return run_on_main(app, move || recognize_vision_macos(&args.png_path));
    }
    #[cfg(target_os = "ios")]
    {
        let reply = tauri_plugin_handwriting::recognize_handwriting(
            &app,
            tauri_plugin_handwriting::RecognizeRequest {
                png_path: args.png_path,
                strokes: args.strokes,
            },
        )
        .await?;
        return Ok(RecognizeReply {
            text: reply.text,
            engine: reply.engine,
        });
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        let _ = (app, args);
        Err("Handschrifterkennung ist nur auf dem Mac und iPad verfügbar.".into())
    }
}

#[cfg(target_os = "macos")]
fn run_on_main<T, F>(app: AppHandle, work: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = tx.send(work());
    })
    .map_err(|error| error.to_string())?;
    rx.recv().map_err(|error| error.to_string())?
}

#[cfg(target_os = "macos")]
fn recognize_vision_macos(path: &str) -> Result<RecognizeReply, String> {
    use objc2::runtime::AnyObject;
    use objc2::{AnyThread, ClassType};
    use objc2_foundation::{NSArray, NSData, NSDictionary, NSString};
    use objc2_vision::{
        VNImageOption, VNImageRequestHandler, VNRecognizeTextRequest, VNRequest,
        VNRequestTextRecognitionLevel,
    };

    let bytes =
        std::fs::read(path).map_err(|error| format!("PNG konnte nicht gelesen werden: {error}"))?;
    let data = NSData::from_vec(bytes);
    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setUsesLanguageCorrection(true);
    let de = NSString::from_str("de-DE");
    let en = NSString::from_str("en-US");
    request.setRecognitionLanguages(&NSArray::from_slice(&[&*de, &*en]));
    let options = NSDictionary::<VNImageOption, AnyObject>::new();
    let handler = VNImageRequestHandler::initWithData_options(
        VNImageRequestHandler::alloc(),
        &data,
        &options,
    );
    let request_ref: &VNRequest = request.as_super().as_super();
    handler
        .performRequests_error(&NSArray::from_slice(&[request_ref]))
        .map_err(|err| err.localizedDescription().to_string())?;
    let mut lines: Vec<String> = Vec::new();
    if let Some(results) = request.results() {
        for observation in results {
            let candidates = observation.topCandidates(1);
            if let Some(first) = candidates.firstObject() {
                lines.push(first.string().to_string());
            }
        }
    }
    Ok(RecognizeReply {
        text: lines.join("\n"),
        engine: "vision".into(),
    })
}
