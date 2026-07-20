import SwiftUI

@main
struct TRAKWatchApp: App {
    @StateObject private var session = WatchSessionManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
                // Drives every Text(LocalizedStringKey) on the watch. String(localized:)
                // call sites resolve at call time and ignore this, so they pass
                // `locale:` explicitly.
                .environment(\.locale, session.workoutState.locale)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { session.syncRestFromClock() }
        }
    }
}
