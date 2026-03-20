package com.sweptmind.geofence

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Geofence")
class GeofencePlugin : Plugin() {
    private lateinit var geofenceManager: GeofenceManager

    override fun load() {
        geofenceManager = GeofenceManager(context)
        geofenceManager.onTransition = { identifier, type, latitude, longitude ->
            val data = JSObject().apply {
                put("identifier", identifier)
                put("type", type)
                put("latitude", latitude)
                put("longitude", longitude)
            }
            notifyListeners("geofenceTransition", data)
        }
    }

    @PluginMethod
    fun addGeofences(call: PluginCall) {
        val geofencesArray = call.getArray("geofences") ?: run {
            call.reject("Missing geofences array")
            return
        }

        val configs = mutableListOf<GeofenceConfig>()
        for (i in 0 until geofencesArray.length()) {
            val obj = geofencesArray.getJSONObject(i)
            configs.add(
                GeofenceConfig(
                    identifier = obj.getString("identifier"),
                    latitude = obj.getDouble("latitude"),
                    longitude = obj.getDouble("longitude"),
                    radiusMeters = obj.getDouble("radiusMeters").toFloat(),
                    notifyOnEntry = obj.optBoolean("notifyOnEntry", true),
                    notifyOnExit = obj.optBoolean("notifyOnExit", false),
                    notificationTitle = obj.optString("notificationTitle", null),
                    notificationBody = obj.optString("notificationBody", null),
                )
            )
        }

        geofenceManager.addGeofences(configs)
        call.resolve()
    }

    @PluginMethod
    fun removeGeofences(call: PluginCall) {
        val identifiers = call.getArray("identifiers") ?: run {
            call.reject("Missing identifiers array")
            return
        }
        val ids = mutableListOf<String>()
        for (i in 0 until identifiers.length()) {
            ids.add(identifiers.getString(i))
        }
        geofenceManager.removeGeofences(ids)
        call.resolve()
    }

    @PluginMethod
    fun removeAllGeofences(call: PluginCall) {
        geofenceManager.removeAllGeofences()
        call.resolve()
    }

    @PluginMethod
    fun getMonitoredGeofences(call: PluginCall) {
        val geofences = geofenceManager.getMonitoredGeofences()
        val result = JSArray()
        for (g in geofences) {
            result.put(JSObject().apply {
                put("identifier", g.identifier)
                put("latitude", g.latitude)
                put("longitude", g.longitude)
                put("radiusMeters", g.radiusMeters)
            })
        }
        call.resolve(JSObject().apply { put("geofences", result) })
    }

    @PluginMethod
    fun requestAlwaysPermission(call: PluginCall) {
        // On Android, background location is requested via runtime permissions
        // which Capacitor handles. For now, check the current status.
        call.resolve(JSObject().apply {
            put("status", geofenceManager.getPermissionStatus())
        })
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("status", geofenceManager.getPermissionStatus())
        })
    }
}
