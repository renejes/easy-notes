const COMMANDS: &[&str] = &[
    "recognize_handwriting",
    "ink_overlay_supported",
    "attach_ink_overlay",
    "update_ink_overlay",
    "set_ink_tool",
    "detach_ink_overlay",
];

fn main() {
    println!("cargo:rerun-if-changed=ios/Sources/HandwritingPlugin.swift");
    println!("cargo:rerun-if-changed=ios/Sources/InkOverlay.swift");
    tauri_plugin::Builder::new(COMMANDS)
        .ios_path("ios")
        .build();
}
