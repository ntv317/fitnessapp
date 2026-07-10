import Foundation
import WatchConnectivity
import Combine

class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    @Published var workoutState = WorkoutState()
    @Published var restTimeRemaining: Int = 0
    @Published var restEndDate: Date?
    private var restTimer: Timer?

    private override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: - Outbound (watch → phone)

    func sendLoggedSet(reps: Int, weight: Double, setOrder: Int) {
        let payload: [String: Any] = [
            "type": "logSet",
            "reps": reps,
            "weight": weight,
            "setOrder": setOrder,
        ]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil) { [weak self] _ in
                self?.fallbackTransfer(payload)
            }
        } else {
            fallbackTransfer(payload)
        }
    }

    func sendFinishWorkout() {
        let payload: [String: Any] = ["type": "finishWorkout"]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil) { [weak self] _ in
                self?.fallbackTransfer(payload)
            }
        } else {
            fallbackTransfer(payload)
        }
    }

    /// Clears the workout back to Idle after "Finish" — nothing pushes a
    /// cleared state from the phone, so without this the summary sticks
    /// until the next workout. Prefs and the premium lock are kept.
    func finishWorkoutLocally() {
        DispatchQueue.main.async {
            self.workoutState.exerciseName = ""
            self.workoutState.workoutName = ""
            self.workoutState.isWorkoutComplete = false
            self.workoutState.isResting = false
            self.workoutState.totalVolume = 0
            self.workoutState.elapsedMinutes = 0
            self.workoutState.setNumber = 1
        }
    }

    // MARK: - Rest timer

    // Wall-clock based: the watch app suspends when the wrist drops, freezing
    // Timer ticks. Anchoring to an end Date keeps the countdown correct on
    // resume, and lets RestView use Text(timerInterval:) which the system
    // renders live even while the app is inactive (always-on display).
    func startRestTimer(duration: Int) {
        restTimer?.invalidate()
        let end = Date().addingTimeInterval(TimeInterval(duration))
        DispatchQueue.main.async {
            self.restEndDate = end
            self.restTimeRemaining = duration
        }
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.syncRestFromClock()
        }
    }

    func syncRestFromClock() {
        DispatchQueue.main.async {
            guard let end = self.restEndDate else { return }
            let remaining = Int(ceil(end.timeIntervalSinceNow))
            if remaining > 0 {
                self.restTimeRemaining = remaining
            } else {
                self.restTimer?.invalidate()
                self.restEndDate = nil
                self.restTimeRemaining = 0
                self.workoutState.isResting = false
            }
        }
    }

    func skipRest() {
        restTimer?.invalidate()
        DispatchQueue.main.async {
            self.restEndDate = nil
            self.restTimeRemaining = 0
            self.workoutState.isResting = false
        }
    }

    /// Skip initiated on the watch — also tell the phone so both timers end together.
    func userSkipRest() {
        let payload: [String: Any] = ["type": "skipRest"]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        } else {
            WCSession.default.transferUserInfo(payload)
        }
        skipRest()
    }

    // MARK: - Private

    private func applyUpdate(_ dict: [String: Any]) {
        if let type = dict["type"] as? String, type == "skipRest" {
            skipRest(); return
        }
        let wasResting = workoutState.isResting
        workoutState.update(from: dict)
        if !wasResting && workoutState.isResting {
            startRestTimer(duration: workoutState.restDuration)
        }
    }

    private func fallbackTransfer(_ payload: [String: Any]) {
        WCSession.default.transferUserInfo(payload)
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        // didReceiveApplicationContext only fires for NEW contexts — on a cold
        // start the last-known state (incl. the premium lock) must be read back
        // from the persisted context or the app runs on defaults. A persisted
        // rest state is stale by definition here — never restart the countdown
        // from it (unlike the live path below, where isResting may be a
        // genuine in-progress push).
        let context = session.receivedApplicationContext
        if !context.isEmpty {
            var sanitized = Self.discardIfStale(context)
            sanitized["isResting"] = false
            DispatchQueue.main.async { self.applyUpdate(sanitized) }
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        // Only the staleness discard applies to a live push — NOT the
        // isResting reset above. updateState() (WatchSyncModule.swift) sends
        // every state via both sendMessage and updateApplicationContext, so a
        // genuine isResting:true delivered live must not be stomped back to
        // false when the (redundant) application-context copy arrives.
        DispatchQueue.main.async { self.applyUpdate(Self.discardIfStale(context)) }
    }

    /// A snapshot older than 4h is yesterday's workout: restore only the
    /// premium lock, not the workout, so the watch wakes up Idle instead of
    /// mid-set. Contexts without a stamp (older phone build) are treated as
    /// stale. Applied to every application-context delivery, cold start and
    /// live, so a live push can't bypass it either.
    private static func discardIfStale(_ context: [String: Any]) -> [String: Any] {
        var context = context
        let sentAtMs = (context["stateAt"] as? Double) ?? 0
        if Date().timeIntervalSince1970 - sentAtMs / 1000 > 4 * 3600 {
            let premium = context["premiumRequired"]
            context = [:]
            if let premium { context["premiumRequired"] = premium }
        }
        return context
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.applyUpdate(message) }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async { self.applyUpdate(userInfo) }
    }
}
