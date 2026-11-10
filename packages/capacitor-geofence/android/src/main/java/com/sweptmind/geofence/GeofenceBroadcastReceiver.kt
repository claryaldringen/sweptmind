package com.sweptmind.geofence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingEvent
import kotlin.concurrent.thread

class GeofenceBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) {
            // GEOFENCE_NOT_AVAILABLE = location turned off; the OS dropped the geofences and the
            // app re-registers them on its next start
            Log.w(GeofenceManager.TAG, "Geofencing error: ${GeofenceStatusCodes.getStatusCodeString(event.errorCode)}")
            return
        }
        if (event.geofenceTransition != Geofence.GEOFENCE_TRANSITION_ENTER) return

        val manager = GeofenceManager(context)
        if (!manager.notificationsEnabled()) return

        // Claimed here, on the main thread, so a second entry during the server check is skipped
        val now = System.currentTimeMillis()
        val claimed = (event.triggeringGeofences ?: emptyList())
            .map { it.requestId }
            .filter { manager.storedNotification(it) != null }
            .mapNotNull { id -> manager.claimCooldown(id, now)?.let { previous -> id to previous } }
        if (claimed.isEmpty()) return

        // Cookies are read here, on the main thread; the request must not run on it
        val request = manager.verificationRequest()
        val pending = goAsync()
        thread(name = "GeofenceCheck") {
            try {
                // The geofences only change while the app runs — ask whether the place still has
                // an actionable task (and for its current text). Unknown → the registered text.
                val current = request?.let { GeofenceVerifier.fetchWithin(it) }
                for ((identifier, previous) in claimed) {
                    val text = if (current != null) current[identifier] else manager.storedNotification(identifier)
                    val shown = text != null && manager.showNotification(identifier, text)
                    if (!shown) manager.releaseCooldown(identifier, previous)
                }
            } finally {
                pending.finish()
            }
        }
    }
}
