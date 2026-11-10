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
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.common.api.ApiException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
        const val VERIFY_URL_PREFS_KEY = "verify_url"
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
     * [verifyUrl]: where to check a geofence before notifying (see [GeofenceVerifier]).
     * [onResult] receives null on success or an error message.
     */
    fun setGeofences(configs: List<GeofenceConfig>, verifyUrl: String?, onResult: (String?) -> Unit) {
        prefs.edit().apply {
            if (verifyUrl != null) putString(VERIFY_URL_PREFS_KEY, verifyUrl) else remove(VERIFY_URL_PREFS_KEY)
        }.apply()
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

    /** The text registered with [identifier]; null for an unknown geofence. */
    fun storedNotification(identifier: String): NotificationText? {
        val title = prefs.getString("notif:$identifier:title", null) ?: return null
        return NotificationText(
            title = title,
            body = prefs.getString("notif:$identifier:body", "") ?: "",
            url = prefs.getString("notif:$identifier:url", null),
        )
    }

    /**
     * Starts the place's cooldown at [now] unless it was announced less than
     * [NOTIFICATION_COOLDOWN_MS] ago. Returns the previous start (for [releaseCooldown]) or null
     * when cooling down. Claiming before the server check, on the main thread, keeps two quick
     * entries from both notifying.
     */
    fun claimCooldown(identifier: String, now: Long): Long? {
        val key = "lastNotified:$identifier"
        val previous = prefs.getLong(key, 0L)
        if (now - previous < NOTIFICATION_COOLDOWN_MS) return null
        prefs.edit().putLong(key, now).apply()
        return previous
    }

    /** Undoes [claimCooldown] when nothing was shown after all. */
    fun releaseCooldown(identifier: String, previous: Long) {
        prefs.edit().putLong("lastNotified:$identifier", previous).apply()
    }

    /**
     * What to send to the server to check the geofences, or null when it can't be asked
     * (registered by an app version without the check, or the cookies can't be read). Call on
     * the main thread: reading the WebView's cookies may initialize WebView.
     */
    fun verificationRequest(): GeofenceVerifier.Request? {
        val url = prefs.getString(VERIFY_URL_PREFS_KEY, null) ?: return null
        val cookie = try {
            CookieManager.getInstance().getCookie(url)
        } catch (e: Exception) {
            // e.g. WebView being updated — without cookies the server would answer "signed out"
            Log.w(TAG, "Cannot read cookies: ${e.message}")
            return null
        }
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        return GeofenceVerifier.Request(url, cookie, Locale.getDefault().toLanguageTag(), today)
    }

    /** Shows the "you are near ..." notification for [identifier]; false when it couldn't. */
    fun showNotification(identifier: String, text: NotificationText): Boolean {
        if (!notificationsEnabled()) return false

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(GeofencePlugin.EXTRA_URL, text.url ?: DEFAULT_URL)
        }
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                context, identifier.hashCode(), it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon())
            .setContentTitle(text.title)
            .setContentText(text.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text.body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
            .build()

        return try {
            NotificationManagerCompat.from(context).notify(identifier.hashCode(), notification)
            true
        } catch (_: SecurityException) {
            false // POST_NOTIFICATIONS permission not granted
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
