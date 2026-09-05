import Foundation
import PencilKit
import Tauri
import UIKit
import Vision

struct RecognizeArgs: Decodable {
    let pngPath: String
    let strokes: [StrokeWire]
}

struct StrokeWire: Decodable {
    let kind: String?
    let color: String?
    let width: Double?
    let points: [[Double]]
}

struct RecognizeReply: Encodable {
    let text: String
    let engine: String
}

enum HandwritingError: LocalizedError {
    case missingImage
    case visionFailed

    var errorDescription: String? {
        switch self {
        case .missingImage:
            return "PNG für die Erkennung fehlt."
        case .visionFailed:
            return "Handschrift konnte nicht erkannt werden."
        }
    }
}

final class HandwritingPlugin: Plugin {
    @objc public func recognizeHandwriting(_ invoke: Invoke) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let args = try invoke.parseArgs(RecognizeArgs.self)
                if #available(iOS 27.0, *),
                   let text = Self.recognizePencilKit(strokes: args.strokes)
                {
                    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty {
                        invoke.resolve(RecognizeReply(text: trimmed, engine: "pencilkit"))
                        return
                    }
                }
                let text = try Self.recognizeVision(pngPath: args.pngPath)
                invoke.resolve(RecognizeReply(text: text, engine: "vision"))
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }

    @available(iOS 27.0, *)
    private static func recognizePencilKit(strokes: [StrokeWire]) -> String? {
        var pkStrokes: [PKStroke] = []
        for stroke in strokes {
            var points: [PKStrokePoint] = []
            var time: TimeInterval = 0
            let width = CGFloat(stroke.width ?? 2.2)
            for raw in stroke.points where raw.count >= 2 {
                let force = raw.count >= 3 ? CGFloat(raw[2]) : 0.5
                points.append(
                    PKStrokePoint(
                        location: CGPoint(x: raw[0], y: raw[1]),
                        timeOffset: time,
                        size: CGSize(width: width, height: width),
                        opacity: 1,
                        force: force,
                        azimuth: 0,
                        altitude: .pi / 2
                    )
                )
                time += 0.016
            }
            guard points.count >= 2 else {
                continue
            }
            let path = PKStrokePath(controlPoints: points, creationDate: Date())
            let inkKind: PKInk.Kind = stroke.kind == "marker" ? .marker : .pen
            pkStrokes.append(PKStroke(ink: PKInk(inkKind, color: .black), path: path))
        }
        guard !pkStrokes.isEmpty else {
            return nil
        }
        let drawing = PKDrawing(strokes: pkStrokes)
        let recognizer = PKStrokeRecognizer()
        var recognized: String?
        let lock = DispatchSemaphore(value: 0)
        Task { @MainActor in
            await recognizer.updateDrawing(drawing)
            recognized = await recognizer.recognizedText()
            lock.signal()
        }
        _ = lock.wait(timeout: .now() + 20)
        return recognized
    }

    private static func recognizeVision(pngPath: String) throws -> String {
        guard let image = UIImage(contentsOfFile: pngPath), let cgImage = image.cgImage else {
            throw HandwritingError.missingImage
        }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["de-DE", "en-US"]
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([request])
        let observations = request.results ?? []
        let lines = observations.compactMap { $0.topCandidates(1).first?.string }
        return lines.joined(separator: "\n")
    }
}

@_cdecl("init_plugin_handwriting")
func initPluginHandwriting() -> Plugin {
    HandwritingPlugin()
}
