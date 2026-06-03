import ExpoModulesCore
import WatchConnectivity

public class WatchSyncModule: Module {
  private let session = WatchSessionHandler()

  public func definition() -> ModuleDefinition {
    Name("WatchSync")

    Events("onSetLogged", "onFinishWorkout", "onSkipRest")

    OnCreate {
      self.session.onEvent = { [weak self] name, payload in
        self?.sendEvent(name, payload)
      }
      self.session.activate()
    }

    // Phone -> Watch: push the latest workout snapshot.
    Function("updateState") { (state: [String: Any]) in
      self.session.updateState(state)
    }

    // Phone -> Watch: one-off message (e.g. { type: "skipRest" }).
    Function("sendMessage") { (message: [String: Any]) in
      self.session.sendMessage(message)
    }

    Function("isReachable") { () -> Bool in
      return self.session.isReachable
    }
  }
}

final class WatchSessionHandler: NSObject, WCSessionDelegate {
  var onEvent: ((String, [String: Any]) -> Void)?

  var isReachable: Bool {
    WCSession.isSupported() && WCSession.default.isReachable
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func updateState(_ state: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    // applicationContext = latest snapshot, delivered even if the watch is asleep.
    try? s.updateApplicationContext(state)
    // Also push immediately if the watch app is in the foreground.
    if s.isReachable {
      s.sendMessage(state, replyHandler: nil, errorHandler: nil)
    }
  }

  func sendMessage(_ message: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    if s.isReachable {
      s.sendMessage(message, replyHandler: nil, errorHandler: nil)
    } else {
      s.transferUserInfo(message)
    }
  }

  private func handleInbound(_ dict: [String: Any]) {
    guard let type = dict["type"] as? String else { return }
    switch type {
    case "logSet":
      onEvent?("onSetLogged", [
        "reps": (dict["reps"] as? NSNumber)?.intValue ?? 0,
        "weight": (dict["weight"] as? NSNumber)?.doubleValue ?? 0,
        "setOrder": (dict["setOrder"] as? NSNumber)?.intValue ?? 0,
      ])
    case "finishWorkout":
      onEvent?("onFinishWorkout", [:])
    case "skipRest":
      onEvent?("onSkipRest", [:])
    default:
      break
    }
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async { self.handleInbound(message) }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    DispatchQueue.main.async { self.handleInbound(userInfo) }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async { self.handleInbound(applicationContext) }
  }
}
