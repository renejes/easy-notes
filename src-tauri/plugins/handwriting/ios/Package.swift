// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "tauri-plugin-handwriting",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "tauri-plugin-handwriting",
            type: .static,
            targets: ["tauri-plugin-handwriting"]
        )
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-handwriting",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources",
            linkerSettings: [
                .linkedFramework("Vision"),
                .linkedFramework("PencilKit")
            ]
        )
    ]
)
