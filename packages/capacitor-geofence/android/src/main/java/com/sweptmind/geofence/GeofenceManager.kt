package com.sweptmind.geofence

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices

data class GeofenceConfig(
    val identifier: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Float,
    val notifyOnEntry: Boolean = true,
    val notifyOnExit: Boolean = false,
    val notificationTitle: String? = null,
    val notificationBody: String? = null,
)

class GeofenceManager(private val context: Context) {
    private val geofencingClient = LocationServices.getGeofencingClient(context)
    private val prefs: SharedPreferences =
        context.getSharedPreferences("geofence_data", Context.MODE_PRIVATE)

    var onTransition: ((identifier: String, type: String, latitude: Double, longitude: Double) -> Unit)? = null

    companion object {
        const val CHANNEL_ID = "geofence_notifications"
        const val GEOFENCE_PREFS_KEY = "registered_geofences"
    }

    init {
        createNotificationChannel()
    }

    fun addGeofences(configs: List<GeofenceConfig>) {
        if (!hasLocationPermission()) return

        val geofenceList = configs.map { config ->
            var transitionTypes = 0
            if (config.notifyOnEntry) transitionTypes = transitionTypes or Geofence.GEOFENCE_TRANSITION_ENTER
            if (config.notifyOnExit) transitionTypes = transitionTypes or Geofence.GEOFENCE_TRANSITION_EXIT

            Geofence.Builder()
                .setRequestId(config.identifier)
                .setCircularRegion(config.latitude, config.longitude, maxOf(config.radiusMeters, 200f))
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(transitionTypes)
                .build()
        }

        if (geofenceList.isEmpty()) return

        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofenceList)
            .build()

        try {
            geofencingClient.addGeofences(request, getGeofencePendingIntent())
        } catch (e: SecurityException) {
            // Permission not granted
        }

        // Save notification data and geofence configs for BroadcastReceiver and BootReceiver
        val editor = prefs.edit()
        for (config in configs) {
            if (config.notificationTitle != null) {
                editor.putString("notif:${config.identifier}:title", config.notificationTitle)
                editor.putString("notif:${config.identifier}:body", config.notificationBody ?: "")
            }
            // Save full config for restoration after reboot
            editor.putString("geo:${config.identifier}",
                "${config.latitude},${config.longitude},${config.radiusMeters},${config.notifyOnEntry},${config.notifyOnExit}")
        }
        // Track registered identifiers
        val existing = prefs.getStringSet(GEOFENCE_PREFS_KEY, mutableSetOf()) ?: mutableSetOf()
        val updated = existing.toMutableSet()
        configs.forEach { updated.add(it.identifier) }
        editor.putStringSet(GEOFENCE_PREFS_KEY, updated)
        editor.apply()
    }

    fun removeGeofences(identifiers: List<String>) {
        geofencingClient.removeGeofences(identifiers)
        val editor = prefs.edit()
        for (id in identifiers) {
            editor.remove("notif:$id:title")
            editor.remove("notif:$id:body")
            editor.remove("geo:$id")
        }
        val existing = prefs.getStringSet(GEOFENCE_PREFS_KEY, mutableSetOf()) ?: mutableSetOf()
        val updated = existing.toMutableSet()
        identifiers.forEach { updated.remove(it) }
        editor.putStringSet(GEOFENCE_PREFS_KEY, updated)
        editor.apply()
    }

    fun removeAllGeofences() {
        val identifiers = prefs.getStringSet(GEOFENCE_PREFS_KEY, emptySet()) ?: emptySet()
        if (identifiers.isNotEmpty()) {
            geofencingClient.removeGeofences(identifiers.toList())
        }
        val editor = prefs.edit()
        for (id in identifiers) {
            editor.remove("notif:$id:title")
            editor.remove("notif:$id:body")
            editor.remove("geo:$id")
        }
        editor.putStringSet(GEOFENCE_PREFS_KEY, emptySet())
        editor.apply()
    }

    fun getMonitoredGeofences(): List<GeofenceConfig> {
        val identifiers = prefs.getStringSet(GEOFENCE_PREFS_KEY, emptySet()) ?: emptySet()
        return identifiers.mapNotNull { id ->
            val data = prefs.getString("geo:$id", null) ?: return@mapNotNull null
            val parts = data.split(",")
            if (parts.size < 3) return@mapNotNull null
            GeofenceConfig(
                identifier = id,
                latitude = parts[0].toDouble(),
                longitude = parts[1].toDouble(),
                radiusMeters = parts[2].toFloat(),
            )
        }
    }

    fun getPermissionStatus(): String {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        if (fine != PackageManager.PERMISSION_GRANTED) return "denied"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val bg = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            return if (bg == PackageManager.PERMISSION_GRANTED) "always" else "whenInUse"
        }
        return "always"
    }

    fun restoreGeofences() {
        val configs = getMonitoredGeofences()
        if (configs.isNotEmpty()) {
            // Re-read notification data
            val fullConfigs = configs.map { config ->
                config.copy(
                    notificationTitle = prefs.getString("notif:${config.identifier}:title", null),
                    notificationBody = prefs.getString("notif:${config.identifier}:body", null),
                )
            }
            addGeofences(fullConfigs)
        }
    }

    private fun getGeofencePendingIntent(): PendingIntent {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        return PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for nearby tasks"
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
