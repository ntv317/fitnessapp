import SwiftUI

@main
struct TRAKWatchApp: App {
    @StateObject private var session = WatchSessionManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { session.syncRestFromClock() }
        }
    }
}
