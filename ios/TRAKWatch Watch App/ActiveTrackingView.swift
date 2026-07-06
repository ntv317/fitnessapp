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

    // Rest is shown by RestView (ContentView routes on isResting), so this screen
    // only handles active input — a single fitted, non-scrolling layout that
    // adapts to the watch height via the flexible Spacer.
    var body: some View {
        ScrollView {
            VStack(spacing: 4) {
                header
                weightCard
                repsCard
                logButton.padding(.top, 2)
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 2)
        }
        .onAppear(perform: resetToSuggested)
        .onChange(of: session.workoutState.exerciseName) { _, _ in resetToSuggested() }
        .onChange(of: session.workoutState.setNumber)    { _, _ in resetToSuggested() }
        .onChange(of: session.workoutState.suggestedWeight) { _, _ in
            weight = session.workoutState.suggestedWeight
        }
        .onChange(of: session.workoutState.suggestedReps) { _, new in
            if new > 0 { reps = new }
        }
    }

    // MARK: - Subviews

    private var header: some View {
        VStack(spacing: 1) {
            Text("Set \(session.workoutState.setNumber) of \(session.workoutState.totalSets)")
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundColor(.secondary)
                .textCase(.uppercase)
            Text(session.workoutState.exerciseName)
                .font(.system(size: 15, weight: .bold))
                .multilineTextAlignment(.center)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private var weightPrev: String {
        session.workoutState.suggestedWeight > 0
            ? "\(Self.format(session.workoutState.suggestedWeight)) PREV"
            : "WEIGHT"
    }

    private var repsPrev: String {
        session.workoutState.suggestedReps > 0
            ? "\(session.workoutState.suggestedReps) PREV"
            : "COUNT"
    }

    private var weightCard: some View {
        let accent = Color(hex: session.workoutState.accentColor)
        return InputCard(
            leftLabel: "Weight (\(unitLabel))",
            rightLabel: weightPrev,
            rightLabelColor: session.workoutState.suggestedWeight > 0 ? accent : .secondary
        ) {
            HStack(spacing: 4) {
                CircleStepButton(icon: "minus") { weight = max(0, weight - step) }
                Text(weightDisplay)
                    .font(.system(size: 32, weight: .bold).monospacedDigit())
                    .frame(maxWidth: .infinity)
                    .lineLimit(1)
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
            if session.workoutState.showPlateBreakdown && !session.workoutState.plateBreakdown.isEmpty {
                plateRow
            }
            if session.workoutState.showWeightConversion && weight > 0 {
                conversionRow
            }
        }
    }

    private var conversionRow: some View {
        let converted: String = session.workoutState.unit == "kg"
            ? "≈ \(Int((weight * 2.20462).rounded())) lbs"
            : "≈ \(String(format: "%.1f", weight * 0.453592)) kg"
        return Text(converted)
            .font(.system(size: 10, design: .monospaced))
            .foregroundColor(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
    }

    private var plateRow: some View {
        let accent = Color(hex: session.workoutState.accentColor)
        return HStack(spacing: 3) {
            ForEach(Array(session.workoutState.plateBreakdown.enumerated()), id: \.offset) { _, plate in
                Text(plate.truncatingRemainder(dividingBy: 1) == 0
                     ? "\(Int(plate))"
                     : String(format: "%g", plate))
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(accent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(accent.opacity(0.22))
                    .clipShape(Capsule())
            }
            Text("\(unitLabel) / side")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
        .padding(.top, 1)
    }

    private var repsCard: some View {
        let accent = Color(hex: session.workoutState.accentColor)
        return InputCard(
            leftLabel: "Reps",
            rightLabel: repsPrev,
            rightLabelColor: session.workoutState.suggestedReps > 0 ? accent : .secondary
        ) {
            HStack(spacing: 4) {
                CircleStepButton(icon: "minus") { reps = max(1, reps - 1) }
                Text("\(reps)")
                    .font(.system(size: 32, weight: .bold).monospacedDigit())
                    .frame(maxWidth: .infinity)
                    .lineLimit(1)
                CircleStepButton(icon: "plus") { reps = min(99, reps + 1) }
            }
        }
    }

    private var logButton: some View {
        Button(action: isResting ? session.skipRest : logSet) {
            HStack(spacing: 6) {
                Image(systemName: isResting ? "timer" : "checkmark.circle.fill")
                    .font(.system(size: 16, weight: .semibold))
                if isResting {
                    // monospacedDigit only affects digits, so one Text covers both
                    // segments (Text + Text is deprecated on watchOS 26).
                    Text("\(restCountdown) Resting")
                        .font(.system(size: 15, weight: .semibold).monospacedDigit())
                        .foregroundColor(.white)
                } else {
                    Text("LOG SET")
                        .font(.system(size: 15, weight: .bold))
                        .tracking(1.5)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .tint(isResting ? TRAKColor.tertiary : TRAKColor.primary)
    }

    // MARK: - Helpers

    private var weightDisplay: String { Self.format(weight) }

    private static func format(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(value))"
            : String(format: "%.1f", value)
    }

    private var restCountdown: String {
        let s = session.restTimeRemaining
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    private func resetToSuggested() {
        // A 0-rep suggestion (no history) must not zero the input: the phone
        // silently drops reps == 0, so LOG SET would haptic-confirm a set that
        // never lands.
        weight = session.workoutState.suggestedWeight
        let suggested = session.workoutState.suggestedReps
        reps = suggested > 0 ? suggested : 10
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
    var rightLabelColor: Color = .secondary
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 2) {
            HStack {
                Text(leftLabel)
                    .foregroundColor(.secondary)
                Spacer()
                Text(rightLabel)
                    .foregroundColor(rightLabelColor)
            }
            .font(.system(size: 10, design: .monospaced))
            .padding(.horizontal, 8)
            content()
        }
        .padding(.vertical, 2)
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
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 36, height: 36)
                .background(Color.white.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .buttonStyle(.borderless)
        .foregroundColor(.white)
    }
}
