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
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        DispatchQueue.main.async { self.applyUpdate(context) }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.applyUpdate(message) }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async { self.applyUpdate(userInfo) }
    }
}
