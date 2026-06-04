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
        // One ScrollView holds everything: with the compact sizing it all fits on
        // larger watches (no scroll); on small watches it scrolls. The Log Set
        // button is the last item so it's always reachable.
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
        .onChange(of: session.workoutState.exerciseName) { _ in resetToSuggested() }
        .onChange(of: session.workoutState.setNumber)    { _ in resetToSuggested() }
        // Keep the shown value in step with the previous-session (PREV) value
        // whenever it changes, so the display never drifts from the hint.
        .onChange(of: session.workoutState.suggestedWeight) { _ in
            weight = session.workoutState.suggestedWeight
        }
        .onChange(of: session.workoutState.suggestedReps) { _ in
            reps = session.workoutState.suggestedReps
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
            ? "\(Int(session.workoutState.suggestedWeight)) PREV"
            : "WEIGHT"
    }

    private var repsPrev: String {
        session.workoutState.suggestedReps > 0
            ? "\(session.workoutState.suggestedReps) PREV"
            : "COUNT"
    }

    private var weightCard: some View {
        InputCard(leftLabel: "Weight (\(unitLabel))", rightLabel: weightPrev) {
            HStack(spacing: 4) {
                CircleStepButton(icon: "minus") { weight = max(0, weight - step) }
                Text(weightDisplay)
                    .font(.system(size: 26, weight: .bold).monospacedDigit())
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
            if !session.workoutState.plateBreakdown.isEmpty {
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
        HStack(spacing: 3) {
            ForEach(session.workoutState.plateBreakdown, id: \.self) { plate in
                Text(plate.truncatingRemainder(dividingBy: 1) == 0
                     ? "\(Int(plate))"
                     : String(format: "%g", plate))
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(TRAKColor.primary)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(TRAKColor.primaryTint)
                    .clipShape(Capsule())
            }
            Text("/ side")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    private var repsCard: some View {
        InputCard(leftLabel: "Reps", rightLabel: repsPrev) {
            HStack(spacing: 4) {
                CircleStepButton(icon: "minus") { reps = max(1, reps - 1) }
                Text("\(reps)")
                    .font(.system(size: 26, weight: .bold).monospacedDigit())
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
                    (
                        Text(restCountdown)
                            .font(.system(size: 15, weight: .semibold).monospacedDigit())
                        + Text(" Resting")
                            .font(.system(size: 15, weight: .semibold))
                    )
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
        VStack(spacing: 2) {
            HStack {
                Text(leftLabel); Spacer(); Text(rightLabel)
            }
            .font(.system(size: 10, design: .monospaced))
            .foregroundColor(.secondary)
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
