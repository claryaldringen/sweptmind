import Capacitor
import CoreLocation

@objc(GeofencePlugin)
public class GeofencePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GeofencePlugin"
    public let jsName = "Geofence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMonitoredGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlwaysPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
    ]

    private lazy var manager: GeofenceManager = {
        let mgr = GeofenceManager()
        mgr.onTransition = { [weak self] identifier, type, latitude, longitude in
            self?.notifyListeners("geofenceTransition", data: [
                "identifier": identifier,
                "type": type,
                "latitude": latitude,
                "longitude": longitude,
            ])
        }
        return mgr
    }()

    private var permissionCall: CAPPluginCall?

    @objc func addGeofences(_ call: CAPPluginCall) {
        guard let geofencesArray = call.getArray("geofences") as? [JSObject] else {
            call.reject("Missing geofences array")
            return
        }

        var configs: [(identifier: String, latitude: Double, longitude: Double, radiusMeters: Double, notifyOnEntry: Bool, notifyOnExit: Bool, notificationTitle: String?, notificationBody: String?)] = []

        for obj in geofencesArray {
            guard let identifier = obj["identifier"] as? String,
                  let latitude = obj["latitude"] as? Double,
                  let longitude = obj["longitude"] as? Double,
                  let radiusMeters = obj["radiusMeters"] as? Double else {
                continue
            }
            let notifyOnEntry = obj["notifyOnEntry"] as? Bool ?? true
            let notifyOnExit = obj["notifyOnExit"] as? Bool ?? false
            let notificationTitle = obj["notificationTitle"] as? String
            let notificationBody = obj["notificationBody"] as? String

            configs.append((identifier, latitude, longitude, radiusMeters, notifyOnEntry, notifyOnExit, notificationTitle, notificationBody))
        }

        manager.addGeofences(configs)
        call.resolve()
    }

    @objc func removeGeofences(_ call: CAPPluginCall) {
        guard let identifiers = call.getArray("identifiers") as? [String] else {
            call.reject("Missing identifiers array")
            return
        }
        manager.removeGeofences(identifiers: identifiers)
        call.resolve()
    }

    @objc func removeAllGeofences(_ call: CAPPluginCall) {
        manager.removeAllGeofences()
        call.resolve()
    }

    @objc func getMonitoredGeofences(_ call: CAPPluginCall) {
        let geofences = manager.getMonitoredGeofences()
        call.resolve(["geofences": geofences])
    }

    @objc func requestAlwaysPermission(_ call: CAPPluginCall) {
        permissionCall = call
        manager.requestAlwaysPermission { [weak self] status in
            self?.permissionCall?.resolve(["status": status])
            self?.permissionCall = nil
        }
    }

    @objc func getPermissionStatus(_ call: CAPPluginCall) {
        call.resolve(["status": manager.getPermissionStatus()])
    }
}
