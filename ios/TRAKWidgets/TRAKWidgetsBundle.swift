import WidgetKit
import SwiftUI
import ActivityKit

// Must stay structurally identical to RestTimerAttributes in the LiveActivity
// module — ActivityKit matches the two processes by type name + Codable shape.
struct RestTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var endDate: Date
        var exerciseName: String
        var setNumber: Int
        var totalSets: Int
    }

    var accentHex: String
}

@main
struct TRAKWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RestTimerActivityWidget()
    }
}

private func color(hex: String) -> Color {
    var s = hex.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = UInt64(s, radix: 16) else { return .orange }
    return Color(
        red: Double((v >> 16) & 0xFF) / 255,
        green: Double((v >> 8) & 0xFF) / 255,
        blue: Double(v & 0xFF) / 255
    )
}

struct RestTimerActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerAttributes.self) { context in
            // Lock screen / banner
            LockScreenRestView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let accent = color(hex: context.attributes.accentHex)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("REST")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(accent)
                        Text(context.state.exerciseName)
                            .font(.system(size: 14, weight: .bold))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Date()...max(Date(), context.state.endDate), countsDown: true)
                        .font(.system(size: 28, weight: .bold).monospacedDigit())
                        .foregroundColor(accent)
                        .frame(width: 78)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Set \(context.state.setNumber) of \(context.state.totalSets)")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            } compactLeading: {
                Image(systemName: "timer").foregroundColor(accent)
            } compactTrailing: {
                Text(timerInterval: Date()...max(Date(), context.state.endDate), countsDown: true)
                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundColor(accent)
                    .frame(width: 44)
                    .multilineTextAlignment(.trailing)
            } minimal: {
                Image(systemName: "timer").foregroundColor(accent)
            }
        }
    }
}

struct LockScreenRestView: View {
    let context: ActivityViewContext<RestTimerAttributes>

    var body: some View {
        let accent = color(hex: context.attributes.accentHex)
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 5) {
                    Image(systemName: "timer")
                        .font(.system(size: 12, weight: .bold))
                    Text("REST")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .tracking(1)
                }
                .foregroundColor(accent)
                Text(context.state.exerciseName)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text("Set \(context.state.setNumber) of \(context.state.totalSets)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white.opacity(0.6))
            }
            Spacer()
            Text(timerInterval: Date()...max(Date(), context.state.endDate), countsDown: true)
                .font(.system(size: 38, weight: .bold).monospacedDigit())
                .foregroundColor(accent)
                .frame(maxWidth: 110)
                .multilineTextAlignment(.trailing)
        }
        .padding(16)
    }
}
