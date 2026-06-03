import Foundation

struct WorkoutState {
    var exerciseName: String = ""
    var setNumber: Int = 1
    var totalSets: Int = 3
    var suggestedReps: Int = 10
    var suggestedWeight: Double = 0
    var restDuration: Int = 90
    var isResting: Bool = false
    var isWorkoutComplete: Bool = false
    var totalVolume: Double = 0
    var elapsedMinutes: Int = 0
    var workoutName: String = ""

    mutating func update(from dict: [String: Any]) {
        if let v = dict["exerciseName"] as? String { exerciseName = v }
        if let v = dict["setNumber"] as? Int { setNumber = v }
        if let v = dict["totalSets"] as? Int { totalSets = v }
        if let v = dict["suggestedReps"] as? Int { suggestedReps = v }
        if let v = dict["suggestedWeight"] as? Double { suggestedWeight = v }
        if let v = dict["restDuration"] as? Int { restDuration = v }
        if let v = dict["isResting"] as? Bool { isResting = v }
        if let v = dict["isWorkoutComplete"] as? Bool { isWorkoutComplete = v }
        if let v = dict["totalVolume"] as? Double { totalVolume = v }
        if let v = dict["elapsedMinutes"] as? Int { elapsedMinutes = v }
        if let v = dict["workoutName"] as? String { workoutName = v }
    }
}
