import Foundation
import PencilKit
import UIKit
import WebKit

struct OverlayFrameArgs: Decodable {
    let canvasX: Double
    let canvasY: Double
    let canvasWidth: Double
    let canvasHeight: Double
    let clipX: Double
    let clipY: Double
    let clipWidth: Double
    let clipHeight: Double
    let pageWidth: Double
}

struct AttachOverlayArgs: Decodable {
    let canvasX: Double
    let canvasY: Double
    let canvasWidth: Double
    let canvasHeight: Double
    let clipX: Double
    let clipY: Double
    let clipWidth: Double
    let clipHeight: Double
    let pageWidth: Double
    let kind: String
    let color: String?
    let width: Double?
}

struct SetInkToolArgs: Decodable {
    let kind: String
    let color: String?
    let width: Double?
    let trim: String?
}

struct InkStrokeDTO: Encodable {
    let kind: String?
    let color: String
    let width: Double
    let points: [[Double]]
}

final class InkOverlayController: NSObject, PKCanvasViewDelegate {
    private weak var webView: WKWebView?
    private var host: UIView?
    private var canvas: PKCanvasView?
    private var pageWidth: CGFloat = 768
    private var toolKind = "off"
    private var toolColor = "#111111"
    private var toolWidth: CGFloat = 1.4

    private var awaitingFlush = false
    private var flushing = false
    private var emittedCount = 0

    var onEmit: ((InkStrokeDTO) -> Void)?

    var isReady: Bool {
        canvas != nil && host != nil
    }

    func attach(webView: WKWebView, args: AttachOverlayArgs) {
        self.webView = webView
        applyTool(kind: args.kind, color: args.color, width: args.width)
        ensureCanvas(in: webView)
        applyFrame(OverlayFrameArgs(
            canvasX: args.canvasX,
            canvasY: args.canvasY,
            canvasWidth: args.canvasWidth,
            canvasHeight: args.canvasHeight,
            clipX: args.clipX,
            clipY: args.clipY,
            clipWidth: args.clipWidth,
            clipHeight: args.clipHeight,
            pageWidth: args.pageWidth
        ))
        syncDrawingEnabled()
    }

    func updateFrame(_ args: OverlayFrameArgs) {
        applyFrame(args)
    }

    func setTool(_ args: SetInkToolArgs) {
        if args.trim == "pop" {
            removeLastStroke()
        } else if args.trim == "clear" {
            clearDrawing()
        }
        applyTool(kind: args.kind, color: args.color, width: args.width)
        if toolKind == "off" {
            clearDrawing()
        }
        syncDrawingEnabled()
    }

    func detach() {
        canvas?.delegate = nil
        host?.removeFromSuperview()
        host = nil
        canvas = nil
        webView = nil
        onEmit = nil
        toolKind = "off"
        awaitingFlush = false
        flushing = false
        emittedCount = 0
    }

    private func ensureCanvas(in webView: WKWebView) {
        if canvas != nil, host != nil {
            return
        }
        guard let parent = webView.superview ?? webView.window else {
            return
        }

        let host = UIView()
        host.backgroundColor = .clear
        host.isOpaque = false
        host.clipsToBounds = true
        host.isUserInteractionEnabled = true

        let canvas = PKCanvasView()
        canvas.delegate = self
        canvas.isOpaque = false
        canvas.backgroundColor = .clear
        canvas.isScrollEnabled = false
        canvas.alwaysBounceVertical = false
        canvas.alwaysBounceHorizontal = false
        canvas.delaysContentTouches = false
        canvas.canCancelContentTouches = false
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1
        canvas.bouncesZoom = false
        canvas.drawingPolicy = .pencilOnly
        canvas.overrideUserInterfaceStyle = .light
        canvas.drawingGestureRecognizer.allowedTouchTypes = [
            NSNumber(value: UITouch.TouchType.pencil.rawValue)
        ]
        if let paper = canvas.subviews.first {
            paper.backgroundColor = .clear
        }
        host.addSubview(canvas)
        if let superview = webView.superview {
            superview.insertSubview(host, aboveSubview: webView)
        } else {
            parent.addSubview(host)
        }
        self.host = host
        self.canvas = canvas
    }

    private func applyFrame(_ args: OverlayFrameArgs) {
        guard let webView, let host, let canvas, let parent = host.superview else {
            return
        }
        pageWidth = CGFloat(max(1, args.pageWidth))
        let clip = webView.convert(
            CGRect(x: args.clipX, y: args.clipY, width: args.clipWidth, height: args.clipHeight),
            to: parent
        )
        let paper = webView.convert(
            CGRect(
                x: args.canvasX,
                y: args.canvasY,
                width: args.canvasWidth,
                height: args.canvasHeight
            ),
            to: parent
        )
        host.frame = clip.integral
        canvas.frame = host.convert(paper, from: parent).integral
        applyInkAppearance()
    }

    private func applyTool(kind: String, color: String?, width: Double?) {
        toolKind = kind
        if let color, !color.isEmpty {
            toolColor = color
        }
        if let width, width > 0 {
            toolWidth = CGFloat(width)
        }
        applyInkAppearance()
    }

    private func applyInkAppearance() {
        guard let canvas else {
            return
        }
        let viewWidth = max(1, canvas.bounds.width)
        let ratio = viewWidth / pageWidth
        let color = Self.color(from: toolColor)
        switch toolKind {
        case "marker":
            canvas.tool = PKInkingTool(.marker, color: color, width: max(2, toolWidth * ratio))
        case "pencil":
            canvas.tool = PKInkingTool(.pen, color: color, width: max(0.5, toolWidth * ratio))
        default:
            break
        }
    }

    private func syncDrawingEnabled() {
        let enabled = toolKind == "pencil" || toolKind == "marker"
        host?.isHidden = !enabled
        host?.isUserInteractionEnabled = enabled
        canvas?.isUserInteractionEnabled = enabled
    }

    private func emitStrokes(from drawing: PKDrawing) {
        guard let canvas else {
            return
        }
        let viewWidth = max(1, canvas.bounds.width)
        let scale = pageWidth / viewWidth
        let strokes = drawing.strokes
        guard strokes.count > emittedCount else {
            return
        }
        for stroke in strokes[emittedCount...] {
            var points = samplePoints(from: stroke, scale: scale)
            if points.count == 1 {
                points.append(points[0])
            }
            guard points.count >= 2 else {
                continue
            }
            onEmit?(
                InkStrokeDTO(
                    kind: toolKind == "marker" ? "marker" : nil,
                    color: toolColor,
                    width: emittedWidth(from: stroke, scale: scale),
                    points: points
                )
            )
        }
        emittedCount = strokes.count
    }

    private func samplePoints(from stroke: PKStroke, scale: CGFloat) -> [[Double]] {
        var points: [[Double]] = []
        for point in stroke.path {
            points.append(packedPoint(point.location, scale: scale))
        }
        return points
    }

    private func packedPoint(_ location: CGPoint, scale: CGFloat) -> [Double] {
        return [
            Double(location.x * scale),
            Double(location.y * scale),
            0.5
        ]
    }

    private func emittedWidth(from stroke: PKStroke, scale: CGFloat) -> Double {
        var total: CGFloat = 0
        var count = 0
        for point in stroke.path {
            let size = max(point.size.width, point.size.height)
            if size > 0 {
                total += size
                count += 1
            }
        }
        if count > 0 {
            return Double((total / CGFloat(count)) * scale)
        }
        return Double(toolWidth)
    }

    private func removeLastStroke() {
        guard let canvas, !canvas.drawing.strokes.isEmpty else {
            return
        }
        var strokes = canvas.drawing.strokes
        strokes.removeLast()
        flushing = true
        canvas.drawing = PKDrawing(strokes: strokes)
        flushing = false
        emittedCount = canvas.drawing.strokes.count
    }

    private func clearDrawing() {
        guard let canvas else {
            return
        }
        flushing = true
        canvas.drawing = PKDrawing()
        flushing = false
        emittedCount = 0
    }

    private func flushCompletedStrokes(from canvasView: PKCanvasView) {
        guard awaitingFlush, !flushing, !canvasView.drawing.strokes.isEmpty else {
            return
        }
        awaitingFlush = false
        flushing = true
        emitStrokes(from: canvasView.drawing)
        flushing = false
    }

    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        awaitingFlush = false
    }

    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        awaitingFlush = true
        DispatchQueue.main.async { [weak self] in
            self?.flushCompletedStrokes(from: canvasView)
        }
    }

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        if flushing {
            return
        }
        flushCompletedStrokes(from: canvasView)
    }

    private static func color(from hex: String) -> UIColor {
        var value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if value.count == 3 {
            value = value.map { "\($0)\($0)" }.joined()
        }
        var int: UInt64 = 0
        Scanner(string: value).scanHexInt64(&int)
        let r = CGFloat((int >> 16) & 0xFF) / 255
        let g = CGFloat((int >> 8) & 0xFF) / 255
        let b = CGFloat(int & 0xFF) / 255
        return UIColor(red: r, green: g, blue: b, alpha: 1)
    }
}
