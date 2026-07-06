import SwiftUI

// Routes between screens. Rest state is handled inline inside ActiveTrackingView
// (the button toggles in-place, matching the HTML design).
struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager

    var body: some View {
        Group {
            if session.workoutState.premiumRequired {
                LockedView()
            } else if session.workoutState.isWorkoutComplete {
                SummaryView()
            } else if session.workoutState.exerciseName.isEmpty {
                IdleView()
            } else if session.workoutState.isResting {
                RestView()
            } else {
                ActiveTrackingView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.workoutState.isWorkoutComplete)
        .animation(.easeInOut(duration: 0.2), value: session.workoutState.isResting)
    }
}

// Lives here instead of its own file so the watch target's pbxproj stays untouched.
struct LockedView: View {
    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text("TRAK")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(TRAKColor.primary)
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.top, 6)

            Spacer()

            Image(systemName: "lock.fill")
                .font(.system(size: 28))
                .foregroundColor(TRAKColor.primary)
            Text("LIFTREPS Pro")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.white)
            Text("Unlock the watch app\nin LIFTREPS on your iPhone")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .padding()
    }
}
