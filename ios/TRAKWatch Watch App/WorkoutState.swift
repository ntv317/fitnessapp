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
    var unit: String = "kg"          // weight unit mirrored from the phone
    var weightStep: Double = 2.5     // increment for +/- and the Digital Crown
    var plateBreakdown: [Double] = [] // plates per side, largest-first; empty = no config
    var showWeightConversion: Bool = false
    var showPlateBreakdown: Bool = true
    var accentColor: String = "#a83300"
    // Locked until the phone positively confirms entitlement — a cold start
    // with no received context must not default to unlocked.
    var premiumRequired: Bool = true
    // Mirrored from the phone's in-app language picker, which overrides the
    // watch's own system locale. Empty until the phone syncs, so a cold start
    // falls back to the system language rather than forcing English.
    var language: String = ""

    var locale: Locale { language.isEmpty ? .current : Locale(identifier: language) }

    // Text(LocalizedStringKey) picks up the language from \.environment(\.locale),
    // but String(localized:) resolves against a bundle at call time and ignores it
    // — those sites pass this explicitly. English has no .lproj (it's the
    // development language), so .main is the correct fallback.
    var stringsBundle: Bundle {
        guard !language.isEmpty,
              let path = Bundle.main.path(forResource: language, ofType: "lproj"),
              let bundle = Bundle(path: path)
        else { return .main }
        return bundle
    }

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
        if let v = dict["unit"] as? String { unit = v }
        if let v = dict["weightStep"] as? Double { weightStep = v }
        if let v = dict["plateBreakdown"] as? [Double] { plateBreakdown = v }
        if let v = dict["showWeightConversion"] as? Bool { showWeightConversion = v }
        if let v = dict["showPlateBreakdown"] as? Bool { showPlateBreakdown = v }
        if let v = dict["accentColor"] as? String { accentColor = v }
        if let v = dict["premiumRequired"] as? Bool { premiumRequired = v }
        if let v = dict["language"] as? String { language = v }
    }
}
