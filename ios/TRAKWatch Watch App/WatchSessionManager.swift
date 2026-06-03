import Foundation
import WatchConnectivity
import Combine

class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    @Published var workoutState = WorkoutState()
    @Published var restTimeRemaining: Int = 0
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
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }

    // MARK: - Rest timer

    func startRestTimer(duration: Int) {
        restTimer?.invalidate()
        DispatchQueue.main.async { self.restTimeRemaining = duration }
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            guard let self else { return }
            DispatchQueue.main.async {
                if self.restTimeRemaining > 0 {
                    self.restTimeRemaining -= 1
                } else {
                    timer.invalidate()
                    self.workoutState.isResting = false
                }
            }
        }
    }

    func skipRest() {
        restTimer?.invalidate()
        DispatchQueue.main.async {
            self.restTimeRemaining = 0
            self.workoutState.isResting = false
        }
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
