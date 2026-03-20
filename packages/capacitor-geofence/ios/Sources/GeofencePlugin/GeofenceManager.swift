import CoreLocation
import UserNotifications

class GeofenceManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private let notificationCenter = UNUserNotificationCenter.current()

    var onTransition: ((_ identifier: String, _ type: String, _ latitude: Double, _ longitude: Double) -> Void)?
    private var permissionCallback: ((String) -> Void)?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.allowsBackgroundLocationUpdates = true
    }

    func addGeofences(_ configs: [(identifier: String, latitude: Double, longitude: Double, radiusMeters: Double, notifyOnEntry: Bool, notifyOnExit: Bool, notificationTitle: String?, notificationBody: String?)]) {
        for config in configs {
            let center = CLLocationCoordinate2D(latitude: config.latitude, longitude: config.longitude)
            let radius = max(config.radiusMeters, 200)
            let region = CLCircularRegion(center: center, radius: radius, identifier: config.identifier)
            region.notifyOnEntry = config.notifyOnEntry
            region.notifyOnExit = config.notifyOnExit
            locationManager.startMonitoring(for: region)

            // Register local notification trigger (works even when app is terminated)
            if let title = config.notificationTitle {
                let content = UNMutableNotificationContent()
                content.title = title
                content.body = config.notificationBody ?? ""
                content.sound = .default
                content.categoryIdentifier = "GEOFENCE"

                let trigger = UNLocationNotificationTrigger(region: region, repeats: true)
                let request = UNNotificationRequest(
                    identifier: "geofence-\(config.identifier)",
                    content: content,
                    trigger: trigger
                )
                notificationCenter.add(request) { error in
                    if let error = error {
                        print("[GeofencePlugin] Failed to add notification: \(error)")
                    }
                }
            }
        }
    }

    func removeGeofences(identifiers: [String]) {
        for identifier in identifiers {
            let regions = locationManager.monitoredRegions.filter { $0.identifier == identifier }
            for region in regions {
                locationManager.stopMonitoring(for: region)
            }
            notificationCenter.removePendingNotificationRequests(withIdentifiers: ["geofence-\(identifier)"])
        }
    }

    func removeAllGeofences() {
        for region in locationManager.monitoredRegions {
            locationManager.stopMonitoring(for: region)
        }
        // Remove all geofence notifications
        notificationCenter.getPendingNotificationRequests { requests in
            let geofenceIds = requests
                .filter { $0.identifier.hasPrefix("geofence-") }
                .map { $0.identifier }
            self.notificationCenter.removePendingNotificationRequests(withIdentifiers: geofenceIds)
        }
    }

    func getMonitoredGeofences() -> [[String: Any]] {
        return locationManager.monitoredRegions.compactMap { region in
            guard let circular = region as? CLCircularRegion else { return nil }
            return [
                "identifier": circular.identifier,
                "latitude": circular.center.latitude,
                "longitude": circular.center.longitude,
                "radiusMeters": circular.radius,
            ] as [String: Any]
        }
    }

    func requestAlwaysPermission(completion: @escaping (String) -> Void) {
        permissionCallback = completion
        let status = locationManager.authorizationStatus
        if status == .notDetermined {
            locationManager.requestAlwaysAuthorization()
        } else {
            completion(mapAuthorizationStatus(status))
        }
    }

    func getPermissionStatus() -> String {
        return mapAuthorizationStatus(locationManager.authorizationStatus)
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circular = region as? CLCircularRegion else { return }
        onTransition?(circular.identifier, "enter", circular.center.latitude, circular.center.longitude)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard let circular = region as? CLCircularRegion else { return }
        onTransition?(circular.identifier, "exit", circular.center.latitude, circular.center.longitude)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = mapAuthorizationStatus(manager.authorizationStatus)
        permissionCallback?(status)
        permissionCallback = nil
    }

    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        print("[GeofencePlugin] Monitoring failed for \(region?.identifier ?? "unknown"): \(error)")
    }

    // MARK: - Helpers

    private func mapAuthorizationStatus(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "whenInUse"
        case .denied, .restricted: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "denied"
        }
    }
}
