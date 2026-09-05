const COMMANDS: &[&str] = &["recognize_handwriting"];

fn main() {
    println!("cargo:rerun-if-changed=ios/Sources/HandwritingPlugin.swift");
    tauri_plugin::Builder::new(COMMANDS)
        .ios_path("ios")
        .build();
}
