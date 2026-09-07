import Foundation
import Tauri
import UIKit
import Vision
import WebKit

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
    case missingWebView

    var errorDescription: String? {
        switch self {
        case .missingImage:
            return "PNG für die Erkennung fehlt."
        case .missingWebView:
            return "WKWebView für PencilKit fehlt."
        }
    }
}

final class HandwritingPlugin: Plugin {
    private weak var webView: WKWebView?
    private let overlay = InkOverlayController()

    @objc override public func load(webview: WKWebView) {
        webView = webview
    }

    @objc public func inkOverlaySupported(_ invoke: Invoke) {
        invoke.resolve()
    }

    @objc public func attachInkOverlay(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(AttachOverlayArgs.self)
            runOnMain {
                guard let webView = self.webView ?? self.findWebView() else {
                    invoke.reject(HandwritingError.missingWebView.localizedDescription)
                    return
                }
                self.overlay.onEmit = { [weak self] payload, done in
                    guard let self else {
                        done()
                        return
                    }
                    self.emitStroke(payload, on: webView, done: done)
                }
                self.overlay.attach(webView: webView, args: args)
                if self.overlay.isReady {
                    invoke.resolve()
                } else {
                    invoke.reject(HandwritingError.missingWebView.localizedDescription)
                }
            }
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func updateInkOverlay(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(OverlayFrameArgs.self)
            runOnMain {
                self.overlay.updateFrame(args)
                invoke.resolve()
            }
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func setInkTool(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(SetInkToolArgs.self)
            runOnMain {
                self.overlay.setTool(args) {
                    invoke.resolve()
                }
            }
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func detachInkOverlay(_ invoke: Invoke) {
        runOnMain {
            self.overlay.detach {
                invoke.resolve()
            }
        }
    }

    @objc public func recognizeHandwriting(_ invoke: Invoke) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let args = try invoke.parseArgs(RecognizeArgs.self)
                let text = try Self.recognizeVision(pngPath: args.pngPath)
                invoke.resolve(RecognizeReply(text: text, engine: "vision"))
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }

    private func runOnMain(_ body: @escaping () -> Void) {
        if Thread.isMainThread {
            body()
        } else {
            DispatchQueue.main.async(execute: body)
        }
    }

    private func emitStroke(_ payload: InkStrokeDTO, on webView: WKWebView, done: @escaping () -> Void) {
        var body: [String: Any] = [
            "color": payload.color,
            "width": payload.width,
            "points": payload.points
        ]
        if let kind = payload.kind {
            body["kind"] = kind
        }
        guard let data = try? JSONSerialization.data(withJSONObject: body),
            let json = String(data: data, encoding: .utf8)
        else {
            done()
            return
        }
        let script = """
        (function(payload){
          window.__easyNotesInkQueue = window.__easyNotesInkQueue || [];
          if (typeof window.__easyNotesOnInkStroke === 'function') {
            window.__easyNotesOnInkStroke(payload);
          } else {
            window.__easyNotesInkQueue.push(payload);
          }
        })(\(json));
        """
        webView.evaluateJavaScript(script) { _, _ in
            done()
        }
    }

    private func findWebView() -> WKWebView? {
        func search(_ view: UIView) -> WKWebView? {
            if let webView = view as? WKWebView {
                return webView
            }
            for child in view.subviews {
                if let found = search(child) {
                    return found
                }
            }
            return nil
        }
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else {
                continue
            }
            for window in windowScene.windows {
                if let found = search(window) {
                    return found
                }
            }
        }
        return nil
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
