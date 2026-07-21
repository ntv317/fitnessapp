import ExpoModulesCore

private let CONTAINER_ID = "iCloud.io.liftr.liftreps"
private let MAX_BACKUPS = 3
private let DOWNLOAD_TIMEOUT: TimeInterval = 60

public class ICloudBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ICloudBackup")

    Function("isICloudAvailable") { () -> Bool in
      FileManager.default.ubiquityIdentityToken != nil
    }

    AsyncFunction("uploadBackup") { (localPath: String, fileName: String) -> [String: Any] in
      try Self.validateFileName(fileName)
      let dir = try Self.backupsDir()
      let src = URL(fileURLWithPath: localPath)
      let dest = dir.appendingPathComponent(fileName)

      var coordError: NSError?
      var writeError: Error?
      NSFileCoordinator().coordinate(writingItemAt: dest, options: .forReplacing, error: &coordError) { url in
        do {
          if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
          }
          try FileManager.default.copyItem(at: src, to: url)
        } catch {
          writeError = error
        }
      }
      if let e = coordError { throw e }
      if let e = writeError { throw e }

      try Self.pruneOldBackups(in: dir)
      return Self.backupInfo(for: dest, fileName: fileName, isDownloaded: true)
    }

    AsyncFunction("listBackups") { () -> [[String: Any]] in
      let dir = try Self.backupsDir()
      let urls = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
      return urls.compactMap { url in
        let raw = url.lastPathComponent
        // Not-yet-downloaded iCloud items appear as ".<name>.icloud" placeholders.
        if raw.hasPrefix(".") && raw.hasSuffix(".icloud") {
          let name = String(raw.dropFirst().dropLast(7))
          return Self.backupInfo(for: url, fileName: name, isDownloaded: false)
        }
        if raw.hasPrefix(".") { return nil }
        return Self.backupInfo(for: url, fileName: raw, isDownloaded: true)
      }
      .sorted { ($0["modifiedAt"] as? Double ?? 0) > ($1["modifiedAt"] as? Double ?? 0) }
    }

    AsyncFunction("downloadBackup") { (fileName: String, destinationPath: String) in
      try Self.validateFileName(fileName)
      let dir = try Self.backupsDir()
      let item = dir.appendingPathComponent(fileName)

      if !FileManager.default.fileExists(atPath: item.path) {
        try FileManager.default.startDownloadingUbiquitousItem(at: item)
        let deadline = Date().addingTimeInterval(DOWNLOAD_TIMEOUT)
        while !FileManager.default.fileExists(atPath: item.path) {
          if Date() > deadline {
            throw Exception(name: "DownloadTimeout", description: "Timed out downloading \(fileName) from iCloud")
          }
          Thread.sleep(forTimeInterval: 0.3)
        }
      }

      let dest = URL(fileURLWithPath: destinationPath)
      var coordError: NSError?
      var readError: Error?
      NSFileCoordinator().coordinate(readingItemAt: item, options: [], error: &coordError) { url in
        do {
          if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
          }
          try FileManager.default.copyItem(at: url, to: dest)
        } catch {
          readError = error
        }
      }
      if let e = coordError { throw e }
      if let e = readError { throw e }
    }

    AsyncFunction("deleteBackup") { (fileName: String) in
      try Self.validateFileName(fileName)
      let dir = try Self.backupsDir()
      let item = dir.appendingPathComponent(fileName)
      if FileManager.default.fileExists(atPath: item.path) {
        try FileManager.default.removeItem(at: item)
      } else {
        let placeholder = dir.appendingPathComponent(".\(fileName).icloud")
        if FileManager.default.fileExists(atPath: placeholder.path) {
          try FileManager.default.removeItem(at: placeholder)
        }
      }
    }

    AsyncFunction("replaceDatabaseFile") { (sourcePath: String, destPath: String) in
      let fm = FileManager.default
      // Sidecars are already checkpointed by closeAsync; the main file is
      // swapped atomically so a crash can never leave the DB missing.
      for suffix in ["-wal", "-shm"] {
        let path = destPath + suffix
        if fm.fileExists(atPath: path) {
          try fm.removeItem(atPath: path)
        }
      }
      let src = URL(fileURLWithPath: sourcePath)
      let dest = URL(fileURLWithPath: destPath)
      if fm.fileExists(atPath: destPath) {
        _ = try fm.replaceItemAt(dest, withItemAt: src)
      } else {
        try fm.moveItem(at: src, to: dest)
      }
    }

    AsyncFunction("removeLocalFile") { (path: String) in
      if FileManager.default.fileExists(atPath: path) {
        try FileManager.default.removeItem(atPath: path)
      }
    }
  }

  private static func validateFileName(_ name: String) throws {
    if name.isEmpty || name == "." || name == ".." || name.contains("/") {
      throw Exception(name: "InvalidFileName", description: "Invalid backup file name")
    }
  }

  private static func backupsDir() throws -> URL {
    guard let container = FileManager.default.url(forUbiquityContainerIdentifier: CONTAINER_ID) else {
      throw Exception(name: "ICloudUnavailable", description: "iCloud container unavailable — check the user is signed in to iCloud")
    }
    let dir = container.appendingPathComponent("Backups", isDirectory: true)
    if !FileManager.default.fileExists(atPath: dir.path) {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    return dir
  }

  private static func backupInfo(for url: URL, fileName: String, isDownloaded: Bool) -> [String: Any] {
    let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
    return [
      "fileName": fileName,
      "size": values?.fileSize ?? 0,
      "modifiedAt": (values?.contentModificationDate?.timeIntervalSince1970 ?? 0) * 1000,
      "isDownloaded": isDownloaded,
    ]
  }

  private static func pruneOldBackups(in dir: URL) throws {
    let urls = try FileManager.default.contentsOfDirectory(
      at: dir,
      includingPropertiesForKeys: [.contentModificationDateKey]
    ).filter { !$0.lastPathComponent.hasPrefix(".") }
    guard urls.count > MAX_BACKUPS else { return }
    let sorted = urls.sorted { a, b in
      let da = (try? a.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
      let db = (try? b.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
      return da > db
    }
    for old in sorted.dropFirst(MAX_BACKUPS) {
      try? FileManager.default.removeItem(at: old)
    }
  }
}
