import SwiftUI
import WatchKit

struct SummaryView: View {
    @EnvironmentObject var session: WatchSessionManager
    @State private var finished = false
    @State private var kineticScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            kineticRing
            ScrollView {
                VStack(spacing: 12) {
                    topBar
                    heroSection
                    Divider().background(TRAKColor.divider).padding(.horizontal)
                    statsSection
                    sessionMeta
                    Spacer(minLength: 50)
                }
                .padding(.horizontal, 4)
                .padding(.bottom, 70)
            }
            VStack { Spacer(); finishButton }
        }
        .onAppear {
            WKInterfaceDevice.current().play(.success)
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                kineticScale = 1.08
            }
        }
    }

    private var kineticRing: some View {
        Circle()
            .fill(RadialGradient(
                gradient: Gradient(stops: [
                    .init(color: .clear, location: 0.35),
                    .init(color: TRAKColor.primary.opacity(0.18), location: 0.65),
                    .init(color: .clear, location: 1.0),
                ]),
                center: .center, startRadius: 0, endRadius: 200
            ))
            .scaleEffect(kineticScale)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }

    private var topBar: some View {
        HStack {
            Text("TRAK")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(TRAKColor.primary)
            Spacer()
            Image(systemName: "timer").font(.system(size: 14)).foregroundColor(TRAKColor.primary)
        }
        .padding(.horizontal, 8).padding(.top, 6)
    }

    private var heroSection: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(TRAKColor.primary.opacity(0.20)).frame(width: 44, height: 44)
                Image(systemName: "dumbbell.fill").font(.system(size: 20)).foregroundColor(TRAKColor.primary)
            }
            Text("Workout\nComplete!")
                .font(.system(size: 18, weight: .bold))
                .multilineTextAlignment(.center)
                .foregroundColor(.white)
        }
    }

    private var statsSection: some View {
        VStack(spacing: 8) {
            SummaryStatCard(
                label: String(localized: "TOTAL VOLUME"),
                value: volumeDisplay(session.workoutState.totalVolume),
                unit: session.workoutState.unit
            )
            SummaryStatCard(label: String(localized: "TIME"), value: "\(session.workoutState.elapsedMinutes)", unit: String(localized: "min"))
        }
    }

    private var sessionMeta: some View {
        VStack(spacing: 6) {
            if !session.workoutState.workoutName.isEmpty {
                Text(session.workoutState.workoutName.uppercased())
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.secondary)
            }
            HStack(spacing: 4) {
                Capsule().fill(TRAKColor.primary).frame(width: 16, height: 4)
                Circle().fill(Color(hex: "907065")).frame(width: 4, height: 4)
                Circle().fill(Color(hex: "907065")).frame(width: 4, height: 4)
            }
        }
    }

    private var finishButton: some View {
        Button(action: finish) {
            HStack(spacing: 6) {
                Text(finished ? "Done!" : "Finish").font(.system(size: 15, weight: .semibold))
                Image(systemName: finished ? "checkmark.circle.fill" : "checkmark.square.fill").font(.system(size: 15))
            }
            .frame(maxWidth: .infinity).padding(.vertical, 8)
        }
        .buttonStyle(.borderedProminent)
        .tint(finished ? TRAKColor.tertiary : TRAKColor.primary)
        .padding(.horizontal, 8).padding(.bottom, 8)
        .background(LinearGradient(colors: [.clear, .black.opacity(0.9), .black], startPoint: .top, endPoint: .bottom))
    }

    private func volumeDisplay(_ volume: Double) -> String {
        volume >= 1000 ? String(format: "%.1fk", volume / 1000) : "\(Int(volume))"
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        WKInterfaceDevice.current().play(.success)
        session.sendFinishWorkout()
        // Brief "Done!" beat, then back to Idle.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            session.finishWorkoutLocally()
        }
    }
}

private struct SummaryStatCard: View {
    let label: String; let value: String; let unit: String

    var body: some View {
        VStack(spacing: 2) {
            Text(label).font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundColor(.secondary).textCase(.uppercase)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value).font(.system(size: 28, weight: .bold).monospacedDigit()).foregroundColor(.white)
                Text(unit).font(.system(size: 14)).foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(TRAKColor.cardBg)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TRAKColor.cardBorder, lineWidth: 1))
        .cornerRadius(12)
    }
}
