package com.sweptmind.geofence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** The OS clears all geofences on reboot and on app update — restore them from storage. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> GeofenceManager(context).restoreGeofences()
        }
    }
}
