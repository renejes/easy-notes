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
    private var strokeActive = false
    private var emittedCount = 0
    private var inkScale: CGFloat = 1
    private var inkRatio: CGFloat = 1
    private var inkOriginX: CGFloat = 0
    private var inkOriginY: CGFloat = 0
    private var pendingFrame: OverlayFrameArgs?

    var onEmit: ((InkStrokeDTO, @escaping () -> Void) -> Void)?

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
        if strokeActive || flushing {
            pendingFrame = args
            return
        }
        pendingFrame = nil
        applyFrame(args)
    }

    func setTool(_ args: SetInkToolArgs, completion: @escaping () -> Void) {
        if args.trim == "pop" {
            removeLastStroke()
        } else if args.trim == "clear" {
            clearDrawing()
        }
        applyTool(kind: args.kind, color: args.color, width: args.width)
        if toolKind == "off" {
            flushPending { [weak self] in
                guard let self else {
                    completion()
                    return
                }
                self.settleEmittedInk(force: true) {
                    self.clearDrawing()
                    self.syncDrawingEnabled()
                    completion()
                }
            }
            return
        }
        syncDrawingEnabled()
        completion()
    }

    func detach(completion: @escaping () -> Void) {
        flushPending { [weak self] in
            guard let self else {
                completion()
                return
            }
            self.settleEmittedInk(force: true) {
                self.canvas?.delegate = nil
                self.host?.removeFromSuperview()
                self.host = nil
                self.canvas = nil
                self.webView = nil
                self.onEmit = nil
                self.toolKind = "off"
                self.awaitingFlush = false
                self.flushing = false
                self.strokeActive = false
                self.emittedCount = 0
                completion()
            }
        }
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
        let paperInHost = host.convert(paper, from: parent)
        let visible = paperInHost.intersection(CGRect(origin: .zero, size: host.bounds.size))
        inkRatio = paperInHost.width / pageWidth
        inkScale = pageWidth / max(paperInHost.width, 1)
        if visible.isNull || visible.width < 1 || visible.height < 1 {
            canvas.frame = .zero
            return
        }
        canvas.frame = visible
        inkOriginX = visible.origin.x - paperInHost.origin.x
        inkOriginY = visible.origin.y - paperInHost.origin.y
        applyInkAppearance()
    }

    private func applyPendingFrame() {
        guard let pending = pendingFrame else {
            return
        }
        pendingFrame = nil
        applyFrame(pending)
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
        let ratio = max(inkRatio, 0.01)
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

    private var settling = false

    private func flushPending(completion: @escaping () -> Void) {
        awaitingFlush = false
        DispatchQueue.main.async { [weak self] in
            guard let self, let canvas = self.canvas else {
                completion()
                return
            }
            self.flushPendingFrom(canvas.drawing, completion: completion)
        }
    }

    private func flushPendingFrom(_ drawing: PKDrawing, completion: @escaping () -> Void) {
        let strokes = drawing.strokes
        guard strokes.count > emittedCount else {
            completion()
            return
        }
        let group = DispatchGroup()
        for stroke in strokes[emittedCount...] {
            var points = samplePoints(from: stroke)
            if points.count == 1 {
                points.append(points[0])
            }
            guard points.count >= 2 else {
                continue
            }
            let dto = InkStrokeDTO(
                kind: toolKind == "marker" ? "marker" : nil,
                color: toolColor,
                width: emittedWidth(from: stroke),
                points: points
            )
            if let onEmit {
                group.enter()
                onEmit(dto) {
                    group.leave()
                }
            }
        }
        emittedCount = strokes.count
        group.notify(queue: .main, execute: completion)
    }

    /// Asks the page to paint finished strokes, then removes those strokes from PencilKit.
    private func settleEmittedInk(force: Bool, completion: @escaping () -> Void) {
        guard !settling else {
            completion()
            return
        }
        guard force || !strokeActive else {
            completion()
            return
        }
        let count = min(emittedCount, canvas?.drawing.strokes.count ?? 0)
        guard count > 0 else {
            completion()
            return
        }
        settling = true
        notifyBaked(count) { [weak self] in
            guard let self else {
                completion()
                return
            }
            let dropped = (!self.strokeActive || force) ? self.dropPrefix(count) : 0
            self.settling = false
            if dropped > 0, self.emittedCount > 0, force || !self.strokeActive {
                self.settleEmittedInk(force: force, completion: completion)
                return
            }
            completion()
        }
    }

    private func dropPrefix(_ count: Int) -> Int {
        guard count > 0, let canvas else {
            return 0
        }
        var strokes = canvas.drawing.strokes
        let drop = min(count, strokes.count, emittedCount)
        guard drop > 0 else {
            return 0
        }
        strokes.removeFirst(drop)
        flushing = true
        canvas.drawing = PKDrawing(strokes: strokes)
        flushing = false
        emittedCount = max(0, emittedCount - drop)
        return drop
    }

    private func notifyBaked(_ count: Int, completion: @escaping () -> Void) {
        guard count > 0, let webView else {
            completion()
            return
        }
        let script = "window.__easyNotesOnInkBaked && window.__easyNotesOnInkBaked(\(count));"
        webView.evaluateJavaScript(script) { _, _ in
            completion()
        }
    }

    private func samplePoints(from stroke: PKStroke) -> [[Double]] {
        var points: [[Double]] = []
        for point in stroke.path {
            points.append(packedPoint(point.location))
        }
        return points
    }

    private func packedPoint(_ location: CGPoint) -> [Double] {
        return [
            Double((location.x + inkOriginX) * inkScale),
            Double((location.y + inkOriginY) * inkScale),
            0.5
        ]
    }

    private func emittedWidth(from stroke: PKStroke) -> Double {
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
            return Double((total / CGFloat(count)) * inkScale)
        }
        return Double(toolWidth)
    }

    private func removeLastStroke() {
        guard let canvas, !canvas.drawing.strokes.isEmpty else {
            return
        }
        var strokes = canvas.drawing.strokes
        let removingEmitted = strokes.count <= emittedCount
        strokes.removeLast()
        flushing = true
        canvas.drawing = PKDrawing(strokes: strokes)
        flushing = false
        if removingEmitted {
            emittedCount = max(0, emittedCount - 1)
        }
        emittedCount = min(emittedCount, strokes.count)
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
        flushPendingFrom(canvasView.drawing) { [weak self] in
            guard let self else {
                return
            }
            if !self.strokeActive {
                _ = self.dropPrefix(self.emittedCount)
            }
            self.applyPendingFrame()
            self.flushing = false
        }
    }

    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        strokeActive = true
        awaitingFlush = false
    }

    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        strokeActive = false
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
