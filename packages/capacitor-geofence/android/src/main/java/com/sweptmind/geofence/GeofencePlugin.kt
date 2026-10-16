package com.sweptmind.geofence

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(
    name = "Geofence",
    permissions = [
        Permission(
            alias = "location",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
        ),
        Permission(alias = "backgroundLocation", strings = [Manifest.permission.ACCESS_BACKGROUND_LOCATION]),
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
    ],
)
class GeofencePlugin : Plugin() {
    companion object {
        const val EXTRA_URL = "com.sweptmind.geofence.URL"
        private const val LOCATION = "location"
        private const val BACKGROUND_LOCATION = "backgroundLocation"
        private const val NOTIFICATIONS = "notifications"
    }

    private lateinit var geofenceManager: GeofenceManager

    override fun load() {
        geofenceManager = GeofenceManager(context)
        // App cold-started from a geofence notification
        activity?.intent?.let { consumeOpenUrl(it) }
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        consumeOpenUrl(intent)
    }

    private fun consumeOpenUrl(intent: Intent) {
        val url = intent.getStringExtra(EXTRA_URL) ?: return
        intent.removeExtra(EXTRA_URL)
        // Retained until the web app registers its listener (the WebView may still be loading)
        notifyListeners("notificationOpened", JSObject().apply { put("url", url) }, true)
    }

    @PluginMethod
    fun setGeofences(call: PluginCall) {
        val configs = parseConfigs(call) ?: return
        geofenceManager.setGeofences(configs) { error -> resolveOrReject(call, error) }
    }

    @PluginMethod
    fun addGeofences(call: PluginCall) {
        val configs = parseConfigs(call) ?: return
        geofenceManager.addGeofences(configs) { error -> resolveOrReject(call, error) }
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
        val result = JSArray()
        for (g in geofenceManager.getMonitoredGeofences()) {
            result.put(JSObject().apply {
                put("identifier", g.identifier)
                put("latitude", g.latitude)
                put("longitude", g.longitude)
                put("radiusMeters", g.radiusMeters)
            })
        }
        call.resolve(JSObject().apply { put("geofences", result) })
    }

    /**
     * Requests, in order: foreground location → background location ("Allow all the time";
     * on Android 11+ the OS opens the app's location settings) → notifications (Android 13+).
     */
    @PluginMethod
    fun requestAlwaysPermission(call: PluginCall) {
        if (getPermissionState(LOCATION) != PermissionState.GRANTED) {
            requestPermissionForAlias(LOCATION, call, "afterLocationPermission")
        } else {
            afterLocationPermission(call)
        }
    }

    @PermissionCallback
    private fun afterLocationPermission(call: PluginCall) {
        if (!geofenceManager.hasFineLocation()) {
            resolveStatus(call)
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            getPermissionState(BACKGROUND_LOCATION) != PermissionState.GRANTED
        ) {
            requestPermissionForAlias(BACKGROUND_LOCATION, call, "afterBackgroundPermission")
        } else {
            afterBackgroundPermission(call)
        }
    }

    @PermissionCallback
    private fun afterBackgroundPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED
        ) {
            requestPermissionForAlias(NOTIFICATIONS, call, "afterNotificationPermission")
        } else {
            resolveStatus(call)
        }
    }

    @PermissionCallback
    private fun afterNotificationPermission(call: PluginCall) {
        resolveStatus(call)
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        resolveStatus(call)
    }

    /** Opens the system settings page of this app (to switch location to "Allow all the time"). */
    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    private fun resolveStatus(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("status", geofenceManager.getPermissionStatus())
            put("notifications", if (geofenceManager.notificationsEnabled()) "granted" else "denied")
        })
    }

    private fun resolveOrReject(call: PluginCall, error: String?) {
        if (error == null) call.resolve() else call.reject(error)
    }

    private fun parseConfigs(call: PluginCall): List<GeofenceConfig>? {
        val geofencesArray: JSONArray = call.getArray("geofences") ?: run {
            call.reject("Missing geofences array")
            return null
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
                    notificationTitle = obj.optStringOrNull("notificationTitle"),
                    notificationBody = obj.optStringOrNull("notificationBody"),
                    notificationUrl = obj.optStringOrNull("notificationUrl"),
                )
            )
        }
        return configs
    }

    /** The string at [name], or null when missing or JSON null (optString would give "null"). */
    private fun JSONObject.optStringOrNull(name: String): String? =
        if (isNull(name)) null else optString(name)
}
