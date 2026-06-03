import SwiftUI

// Routes between screens. Rest state is handled inline inside ActiveTrackingView
// (the button toggles in-place, matching the HTML design).
struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager

    var body: some View {
        Group {
            if session.workoutState.isWorkoutComplete {
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
