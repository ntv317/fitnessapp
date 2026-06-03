import SwiftUI

/// Dedicated rest screen on the watch — mirrors the iOS full-screen rest timer:
/// a progress ring + countdown, what's up next, and a Skip action.
struct RestView: View {
    @EnvironmentObject var session: WatchSessionManager

    private var total: Int { max(1, session.workoutState.restDuration) }
    private var progress: Double {
        min(1, max(0, Double(session.restTimeRemaining) / Double(total)))
    }
    private var countdown: String {
        let s = max(0, session.restTimeRemaining)
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "timer")
                Text("REST")
                    .font(.system(size: 13, weight: .bold))
                    .tracking(1)
            }
            .foregroundColor(TRAKColor.primary)

            ZStack {
                Circle()
                    .stroke(TRAKColor.cardBorder, lineWidth: 6)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(TRAKColor.primary, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.25), value: progress)
                Text(countdown)
                    .font(.system(size: 32, weight: .bold).monospacedDigit())
            }
            .frame(width: 118, height: 118)

            VStack(spacing: 1) {
                Text("UP NEXT")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(TRAKColor.primary)
                Text(session.workoutState.exerciseName)
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("Set \(session.workoutState.setNumber) of \(session.workoutState.totalSets)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)
            }

            Button(action: session.userSkipRest) {
                HStack(spacing: 6) {
                    Image(systemName: "forward.end.fill").font(.system(size: 13, weight: .semibold))
                    Text("SKIP REST").font(.system(size: 13, weight: .bold)).tracking(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(TRAKColor.tertiary)
        }
        .padding(.horizontal, 6)
    }
}
