package com.sweptmind.geofence

import android.util.Log
import org.json.JSONException
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Callable
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

data class NotificationText(val title: String, val body: String, val url: String?)

/**
 * Asks the server which location reminders should exist right now. The registered geofences
 * only change while the app runs, so a task completed on another device would otherwise keep
 * announcing itself. The request carries no location and no place.
 */
object GeofenceVerifier {
    private const val TIMEOUT_MS = 4000

    /** Upper bound for the whole check — connect/read timeouts don't cover the DNS lookup. */
    const val DEADLINE_MS = 8000L

    /** [today]: the phone's date (YYYY-MM-DD) — the app built its geofences for it. */
    data class Request(val url: String, val cookie: String?, val language: String, val today: String)

    /** [fetch] that gives up (→ null) after [deadlineMs], whatever is hanging. */
    fun fetchWithin(request: Request, deadlineMs: Long = DEADLINE_MS): Map<String, NotificationText>? {
        val task = FutureTask<Map<String, NotificationText>?>(Callable { fetch(request) })
        thread(isDaemon = true, name = "GeofenceFetch") { task.run() }
        return try {
            task.get(deadlineMs, TimeUnit.MILLISECONDS)
        } catch (e: Exception) {
            Log.w(GeofenceManager.TAG, "Geofence check gave up: $e")
            task.cancel(true)
            null
        }
    }

    /**
     * Notification text per geofence identifier — empty when signed out (nothing to remind
     * of) — or null when the server couldn't say (offline, error); the caller then falls back
     * to the registered text.
     */
    fun fetch(request: Request): Map<String, NotificationText>? {
        var connection: HttpURLConnection? = null
        return try {
            val separator = if (request.url.contains('?')) '&' else '?'
            val url = "${request.url}${separator}today=${URLEncoder.encode(request.today, "UTF-8")}"
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Accept-Language", request.language)
                request.cookie?.let { setRequestProperty("Cookie", it) }
            }
            when (val status = connection.responseCode) {
                HttpURLConnection.HTTP_OK -> parse(connection.inputStream.bufferedReader().use { it.readText() })
                HttpURLConnection.HTTP_UNAUTHORIZED -> emptyMap()
                else -> {
                    Log.w(GeofenceManager.TAG, "Geofence check: HTTP $status")
                    null
                }
            }
        } catch (e: Exception) {
            Log.w(GeofenceManager.TAG, "Geofence check failed: ${e.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * Parses `{ "geofences": [{ identifier, notificationTitle, notificationBody, notificationUrl }] }`
     * (GET /api/location/geofences); null when the response isn't in that shape.
     */
    fun parse(json: String): Map<String, NotificationText>? = try {
        val geofences = JSONObject(json).getJSONArray("geofences")
        val result = mutableMapOf<String, NotificationText>()
        for (i in 0 until geofences.length()) {
            val geofence = geofences.getJSONObject(i)
            result[geofence.getString("identifier")] = NotificationText(
                title = geofence.getString("notificationTitle"),
                body = geofence.optString("notificationBody", ""),
                url = if (geofence.isNull("notificationUrl")) null else geofence.optString("notificationUrl"),
            )
        }
        result
    } catch (e: JSONException) {
        null
    }
}
