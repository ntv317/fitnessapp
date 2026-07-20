import SwiftUI

/// Dedicated rest screen on the watch — mirrors the iOS full-screen rest timer:
/// a progress ring + countdown, what's up next, and a Skip action.
struct RestView: View {
    @EnvironmentObject var session: WatchSessionManager

    private var accent: Color { Color(hex: session.workoutState.accentColor) }
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
            .foregroundColor(accent)

            ZStack {
                Circle()
                    .stroke(TRAKColor.cardBorder, lineWidth: 6)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(accent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.25), value: progress)
                if let end = session.restEndDate, end > Date() {
                    // System-rendered countdown — stays live while the app is
                    // inactive (wrist down / always-on), unlike timer-driven text.
                    Text(timerInterval: Date()...end, countsDown: true)
                        .font(.system(size: 32, weight: .bold).monospacedDigit())
                        .multilineTextAlignment(.center)
                } else {
                    Text(countdown)
                        .font(.system(size: 32, weight: .bold).monospacedDigit())
                }
            }
            .frame(width: 118, height: 118)

            VStack(spacing: 1) {
                Text("UP NEXT")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(accent)
                Text(session.workoutState.exerciseName)
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                // After the final set, setNumber (next open slot) exceeds
                // totalSets — "Set 4 of 3" is nonsense, say what's true instead.
                Text(session.workoutState.setNumber > session.workoutState.totalSets
                     ? String(localized: "All sets done", bundle: session.workoutState.stringsBundle, locale: session.workoutState.locale)
                     : String(localized: "Set \(session.workoutState.setNumber) of \(session.workoutState.totalSets)", bundle: session.workoutState.stringsBundle, locale: session.workoutState.locale))
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
