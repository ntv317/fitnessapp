import SwiftUI
import WatchKit

struct ActiveTrackingView: View {
    @EnvironmentObject var session: WatchSessionManager
    @State private var weight: Double = 0
    @State private var reps: Int = 10
    @FocusState private var crownFocused: Bool

    private var isResting: Bool { session.workoutState.isResting }
    private var step: Double { max(0.5, session.workoutState.weightStep) }
    private var unitLabel: String { session.workoutState.unit.uppercased() }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                header
                weightCard
                    .opacity(isResting ? 0.4 : 1.0)
                    .allowsHitTesting(!isResting)
                repsCard
                    .opacity(isResting ? 0.4 : 1.0)
                    .allowsHitTesting(!isResting)
                prevHint
                progressDots.padding(.top, 4)
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
        }
        // Keep the primary action pinned and always visible without scrolling.
        .safeAreaInset(edge: .bottom) {
            logButton
                .padding(.horizontal, 4)
                .padding(.bottom, 4)
        }
        .animation(.easeInOut(duration: 0.2), value: isResting)
        .onAppear(perform: resetToSuggested)
        .onChange(of: session.workoutState.exerciseName) { _ in resetToSuggested() }
        .onChange(of: session.workoutState.setNumber)    { _ in resetToSuggested() }
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(spacing: 2) {
            Text("Set \(session.workoutState.setNumber) of \(session.workoutState.totalSets)")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundColor(.secondary)
                .textCase(.uppercase)
            Text(session.workoutState.exerciseName)
                .font(.system(size: 16, weight: .bold))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .padding(.top, 4)
    }

    private var weightCard: some View {
        InputCard(leftLabel: unitLabel, rightLabel: "WEIGHT") {
            HStack(spacing: 0) {
                CircleStepButton(icon: "minus") { weight = max(0, weight - step) }
                Text(weightDisplay)
                    .font(.system(size: 30, weight: .bold).monospacedDigit())
                    .frame(minWidth: 70)
                    .focusable(!isResting)
                    .focused($crownFocused)
                    .digitalCrownRotation(
                        $weight,
                        from: 0, through: 1000, by: step,
                        sensitivity: .medium,
                        isContinuous: false,
                        isHapticFeedbackEnabled: true
                    )
                CircleStepButton(icon: "plus") { weight = min(1000, weight + step) }
            }
        }
    }

    private var repsCard: some View {
        InputCard(leftLabel: "COUNT", rightLabel: "REPS") {
            HStack(spacing: 0) {
                CircleStepButton(icon: "minus") { reps = max(1, reps - 1) }
                Text("\(reps)")
                    .font(.system(size: 30, weight: .bold).monospacedDigit())
                    .frame(minWidth: 50)
                CircleStepButton(icon: "plus") { reps = min(99, reps + 1) }
            }
        }
    }

    @ViewBuilder
    private var prevHint: some View {
        if session.workoutState.suggestedWeight > 0 {
            Text("PREV: \(Int(session.workoutState.suggestedWeight)) \(unitLabel) × \(session.workoutState.suggestedReps)")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary)
        }
    }

    private var logButton: some View {
        Button(action: isResting ? session.skipRest : logSet) {
            HStack(spacing: 6) {
                Image(systemName: isResting ? "timer" : "checkmark.circle.fill")
                    .font(.system(size: 16, weight: .semibold))
                if isResting {
                    (
                        Text(restCountdown)
                            .font(.system(size: 15, weight: .semibold).monospacedDigit())
                        + Text(" Resting")
                            .font(.system(size: 15, weight: .semibold))
                    )
                    .foregroundColor(.white)
                } else {
                    Text("Log Set")
                        .font(.system(size: 15, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .tint(isResting ? TRAKColor.tertiary : TRAKColor.primary)
    }

    private var progressDots: some View {
        HStack(spacing: 4) {
            ForEach(1...max(1, session.workoutState.totalSets), id: \.self) { i in
                Circle()
                    .fill(i < session.workoutState.setNumber
                          ? TRAKColor.primary : TRAKColor.dotInactive)
                    .frame(width: 6, height: 6)
            }
        }
    }

    // MARK: - Helpers

    private var weightDisplay: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(weight))"
            : String(format: "%.1f", weight)
    }

    private var restCountdown: String {
        let s = session.restTimeRemaining
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    private func resetToSuggested() {
        weight = session.workoutState.suggestedWeight
        reps   = session.workoutState.suggestedReps
        if !isResting { crownFocused = true }
    }

    private func logSet() {
        WKInterfaceDevice.current().play(.success)
        session.sendLoggedSet(reps: reps, weight: weight, setOrder: session.workoutState.setNumber)
    }
}

// MARK: - Shared components

struct InputCard<Content: View>: View {
    let leftLabel: String
    let rightLabel: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(leftLabel); Spacer(); Text(rightLabel)
            }
            .font(.system(size: 10, design: .monospaced))
            .foregroundColor(.secondary)
            .padding(.horizontal, 8)
            content()
        }
        .padding(.vertical, 8)
        .background(TRAKColor.cardBg)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TRAKColor.cardBorder, lineWidth: 1))
        .cornerRadius(12)
    }
}

struct CircleStepButton: View {
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .frame(width: 38, height: 38)
                .background(Color.white.opacity(0.10))
                .clipShape(Circle())
        }
        .buttonStyle(.borderless)
        .foregroundColor(.white)
    }
}
