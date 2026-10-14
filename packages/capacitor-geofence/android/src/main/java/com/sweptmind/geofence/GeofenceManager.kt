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
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.common.api.ApiException

data class GeofenceConfig(
    val identifier: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Float,
    val notifyOnEntry: Boolean = true,
    val notifyOnExit: Boolean = false,
    val notificationTitle: String? = null,
    val notificationBody: String? = null,
    val notificationUrl: String? = null,
)

class GeofenceManager(private val context: Context) {
    private val geofencingClient = LocationServices.getGeofencingClient(context)
    private val prefs: SharedPreferences =
        context.getSharedPreferences("geofence_data", Context.MODE_PRIVATE)

    companion object {
        const val TAG = "SweptMindGeofence"
        const val CHANNEL_ID = "geofence_notifications"
        const val GEOFENCE_PREFS_KEY = "registered_geofences"
        const val MIN_RADIUS_METERS = 200f

        /** Don't notify about the same place more often than this. */
        const val NOTIFICATION_COOLDOWN_MS = 4 * 60 * 60 * 1000L

        const val DEFAULT_URL = "/nearby"
    }

    init {
        createNotificationChannel()
    }

    /**
     * Replaces all monitored geofences with [configs]. Removal and registration are chained,
     * so the removal can never race with (and delete) the freshly added geofences.
     * [onResult] receives null on success or an error message.
     */
    fun setGeofences(configs: List<GeofenceConfig>, onResult: (String?) -> Unit) {
        geofencingClient.removeGeofences(getGeofencePendingIntent()).addOnCompleteListener {
            clearStoredGeofences()
            if (configs.isEmpty()) {
                onResult(null)
                return@addOnCompleteListener
            }
            addGeofences(configs, onResult)
        }
    }

    fun addGeofences(configs: List<GeofenceConfig>, onResult: (String?) -> Unit) {
        if (configs.isEmpty()) {
            onResult(null)
            return
        }
        if (!hasFineLocation()) {
            onResult("Location permission not granted")
            return
        }

        val geofenceList = configs.map { config ->
            var transitionTypes = 0
            if (config.notifyOnEntry) transitionTypes = transitionTypes or Geofence.GEOFENCE_TRANSITION_ENTER
            if (config.notifyOnExit) transitionTypes = transitionTypes or Geofence.GEOFENCE_TRANSITION_EXIT

            Geofence.Builder()
                .setRequestId(config.identifier)
                .setCircularRegion(config.latitude, config.longitude, maxOf(config.radiusMeters, MIN_RADIUS_METERS))
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(transitionTypes)
                .build()
        }

        // No initial trigger: re-registering (every app start, every task change, after reboot)
        // must not notify about the place the user is already at.
        val request = GeofencingRequest.Builder()
            .setInitialTrigger(0)
            .addGeofences(geofenceList)
            .build()

        // Store data first so the receiver has it even for a transition right after registration
        storeGeofences(configs)

        try {
            geofencingClient.addGeofences(request, getGeofencePendingIntent())
                .addOnSuccessListener { onResult(null) }
                .addOnFailureListener { e ->
                    val message = if (e is ApiException) {
                        GeofenceStatusCodes.getStatusCodeString(e.statusCode)
                    } else {
                        e.message ?: "Unknown error"
                    }
                    Log.w(TAG, "addGeofences failed: $message")
                    onResult(message)
                }
        } catch (e: SecurityException) {
            onResult("Location permission not granted")
        }
    }

    fun removeGeofences(identifiers: List<String>) {
        if (identifiers.isEmpty()) return
        geofencingClient.removeGeofences(identifiers)
        val editor = prefs.edit()
        for (id in identifiers) removeStoredGeofence(editor, id)
        val updated = (prefs.getStringSet(GEOFENCE_PREFS_KEY, emptySet()) ?: emptySet()).toMutableSet()
        identifiers.forEach { updated.remove(it) }
        editor.putStringSet(GEOFENCE_PREFS_KEY, updated)
        editor.apply()
    }

    fun removeAllGeofences() {
        geofencingClient.removeGeofences(getGeofencePendingIntent())
        clearStoredGeofences()
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
                notifyOnEntry = parts.getOrNull(3)?.toBooleanStrictOrNull() ?: true,
                notifyOnExit = parts.getOrNull(4)?.toBooleanStrictOrNull() ?: false,
                notificationTitle = prefs.getString("notif:$id:title", null),
                notificationBody = prefs.getString("notif:$id:body", null),
                notificationUrl = prefs.getString("notif:$id:url", null),
            )
        }
    }

    /** Re-registers stored geofences (after reboot or app update, both of which clear them). */
    fun restoreGeofences() {
        val configs = getMonitoredGeofences()
        if (configs.isEmpty()) return
        addGeofences(configs) { error ->
            if (error != null) Log.w(TAG, "restoreGeofences failed: $error")
        }
    }

    fun hasFineLocation(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun getPermissionStatus(): String {
        if (!hasFineLocation()) return "denied"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val bg = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            return if (bg == PackageManager.PERMISSION_GRANTED) "always" else "whenInUse"
        }
        return "always"
    }

    fun notificationsEnabled(): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

    /** Shows the "you are near ..." notification for [identifier], respecting the cooldown. */
    fun showNotification(identifier: String) {
        val title = prefs.getString("notif:$identifier:title", null) ?: return
        val body = prefs.getString("notif:$identifier:body", "") ?: ""
        val url = prefs.getString("notif:$identifier:url", null) ?: DEFAULT_URL

        val now = System.currentTimeMillis()
        val lastNotified = prefs.getLong("lastNotified:$identifier", 0L)
        if (now - lastNotified < NOTIFICATION_COOLDOWN_MS) return

        if (!notificationsEnabled()) return

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(GeofencePlugin.EXTRA_URL, url)
        }
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                context, identifier.hashCode(), it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
            .build()

        try {
            NotificationManagerCompat.from(context).notify(identifier.hashCode(), notification)
            prefs.edit().putLong("lastNotified:$identifier", now).apply()
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS permission not granted
        }
    }

    private fun storeGeofences(configs: List<GeofenceConfig>) {
        val editor = prefs.edit()
        for (config in configs) {
            if (config.notificationTitle != null) {
                editor.putString("notif:${config.identifier}:title", config.notificationTitle)
                editor.putString("notif:${config.identifier}:body", config.notificationBody ?: "")
            }
            if (config.notificationUrl != null) {
                editor.putString("notif:${config.identifier}:url", config.notificationUrl)
            }
            editor.putString(
                "geo:${config.identifier}",
                "${config.latitude},${config.longitude},${config.radiusMeters},${config.notifyOnEntry},${config.notifyOnExit}"
            )
        }
        val updated = (prefs.getStringSet(GEOFENCE_PREFS_KEY, emptySet()) ?: emptySet()).toMutableSet()
        configs.forEach { updated.add(it.identifier) }
        editor.putStringSet(GEOFENCE_PREFS_KEY, updated)
        editor.apply()
    }

    private fun clearStoredGeofences() {
        val identifiers = prefs.getStringSet(GEOFENCE_PREFS_KEY, emptySet()) ?: emptySet()
        val editor = prefs.edit()
        for (id in identifiers) removeStoredGeofence(editor, id)
        editor.putStringSet(GEOFENCE_PREFS_KEY, emptySet())
        editor.apply()
    }

    // Keeps "lastNotified:<id>" so a re-sync doesn't reset the cooldown
    private fun removeStoredGeofence(editor: SharedPreferences.Editor, id: String) {
        editor.remove("notif:$id:title")
        editor.remove("notif:$id:body")
        editor.remove("notif:$id:url")
        editor.remove("geo:$id")
    }

    private fun getGeofencePendingIntent(): PendingIntent {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        return PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }

    private fun smallIcon(): Int {
        // App-provided monochrome icon (apps/mobile/android), falls back to a system icon
        val appIcon = context.resources.getIdentifier("ic_stat_notification", "drawable", context.packageName)
        return if (appIcon != 0) appIcon else android.R.drawable.ic_dialog_map
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.geofence_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.geofence_channel_description)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
