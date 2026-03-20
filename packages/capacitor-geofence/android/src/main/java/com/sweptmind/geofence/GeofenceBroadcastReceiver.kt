package com.sweptmind.geofence

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

class GeofenceBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) return

        val transitionType = when (event.geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> "enter"
            Geofence.GEOFENCE_TRANSITION_EXIT -> "exit"
            else -> return
        }

        val prefs = context.getSharedPreferences("geofence_data", Context.MODE_PRIVATE)

        for (geofence in event.triggeringGeofences ?: emptyList()) {
            val title = prefs.getString("notif:${geofence.requestId}:title", null)
            if (title != null && transitionType == "enter") {
                val body = prefs.getString("notif:${geofence.requestId}:body", "") ?: ""

                // Create intent to open the app
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                val pendingIntent = if (launchIntent != null) {
                    PendingIntent.getActivity(
                        context, geofence.requestId.hashCode(), launchIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                } else null

                val notification = NotificationCompat.Builder(context, GeofenceManager.CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_map)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
                    .build()

                try {
                    NotificationManagerCompat.from(context).notify(
                        geofence.requestId.hashCode(), notification
                    )
                } catch (_: SecurityException) {
                    // POST_NOTIFICATIONS permission not granted
                }
            }
        }
    }
}
