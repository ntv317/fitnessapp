import ActivityKit
import ExpoModulesCore

// Must stay structurally identical to RestTimerAttributes in the TRAKWidgets
// target — ActivityKit matches the two processes by type name + Codable shape.
@available(iOS 16.2, *)
struct RestTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endDate: Date
    var exerciseName: String
    var setNumber: Int
    var totalSets: Int
  }

  var accentHex: String
}

public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    AsyncFunction("startRestActivity") {
      (exerciseName: String, setNumber: Int, totalSets: Int, endTimestampMs: Double, accentHex: String) async in
      guard #available(iOS 16.2, *) else { return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
      let state = RestTimerAttributes.ContentState(
        endDate: Date(timeIntervalSince1970: endTimestampMs / 1000),
        exerciseName: exerciseName,
        setNumber: setNumber,
        totalSets: totalSets
      )
      // One rest activity at a time: update a live one in place (avoids
      // lock-screen churn between sets). Ghosts persisted from a previous app
      // session are ended, not reused — updates to them would no-op.
      var updated = false
      for activity in Activity<RestTimerAttributes>.activities {
        if activity.activityState == .active && !updated {
          await activity.update(ActivityContent(state: state, staleDate: nil))
          updated = true
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if !updated {
        _ = try? Activity.request(
          attributes: RestTimerAttributes(accentHex: accentHex),
          content: ActivityContent(state: state, staleDate: nil)
        )
      }
    }

    AsyncFunction("updateRestActivity") { (endTimestampMs: Double) async in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<RestTimerAttributes>.activities where activity.activityState == .active {
        var state = activity.content.state
        state.endDate = Date(timeIntervalSince1970: endTimestampMs / 1000)
        await activity.update(ActivityContent(state: state, staleDate: nil))
      }
    }

    AsyncFunction("stopRestActivity") { () async in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<RestTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
