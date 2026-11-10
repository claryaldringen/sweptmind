package com.sweptmind.geofence

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import kotlin.concurrent.thread

class GeofenceVerifierTest {
    private lateinit var server: ServerSocket
    @Volatile private var status = "200 OK"
    @Volatile private var responseBody = """{"geofences":[]}"""
    @Volatile private var receivedHeaders = mapOf<String, String>()
    @Volatile private var receivedPath = ""
    @Volatile private var delayMs = 0L

    /** A one-route HTTP server (java.net only — the JVM unit tests compile against android.jar). */
    @Before
    fun startServer() {
        server = ServerSocket(0, 0, InetAddress.getLoopbackAddress())
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: Exception) { break }
                socket.use {
                    val reader = it.getInputStream().bufferedReader()
                    receivedPath = reader.readLine()?.split(" ")?.getOrNull(1) ?: "" // "GET <path> HTTP/1.1"
                    receivedHeaders = generateSequence { reader.readLine() }
                        .takeWhile { line -> line.isNotEmpty() }
                        .associate { line -> line.substringBefore(":").lowercase() to line.substringAfter(":").trim() }
                    Thread.sleep(delayMs)
                    val bytes = responseBody.toByteArray()
                    val head = "HTTP/1.1 $status\r\nContent-Type: application/json\r\n" +
                        "Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                    it.getOutputStream().apply { write(head.toByteArray()); write(bytes); flush() }
                }
            }
        }
    }

    @After
    fun stopServer() {
        server.close()
    }

    private val url get() = "http://127.0.0.1:${server.localPort}/api/location/geofences"

    private fun request(cookie: String? = "authjs.session-token=abc") =
        GeofenceVerifier.Request(url = url, cookie = cookie, language = "cs-CZ", today = "2026-11-10")

    @Test
    fun `returns the current text of each geofence`() {
        responseBody = """
            {"geofences":[{"identifier":"location:zizkov:5000","latitude":50.08,"longitude":14.47,
            "radiusMeters":5000,"notificationTitle":"Žižkov","notificationBody":"Schůzka",
            "notificationUrl":"/context"}]}
        """.trimIndent()

        val result = GeofenceVerifier.fetch(request())

        assertEquals(
            mapOf("location:zizkov:5000" to NotificationText("Žižkov", "Schůzka", "/context")),
            result,
        )
        assertEquals("authjs.session-token=abc", receivedHeaders["cookie"])
        assertEquals("cs-CZ", receivedHeaders["accept-language"])
        assertEquals("/api/location/geofences?today=2026-11-10", receivedPath)
    }

    @Test
    fun `an empty list means no place should notify`() {
        assertEquals(emptyMap<String, NotificationText>(), GeofenceVerifier.fetch(request()))
    }

    @Test
    fun `signed out means nothing to remind of`() {
        status = "401 Unauthorized"
        responseBody = """{"error":"Unauthorized"}"""
        assertEquals(emptyMap<String, NotificationText>(), GeofenceVerifier.fetch(request(cookie = null)))
    }

    @Test
    fun `server error is unknown`() {
        status = "500 Internal Server Error"
        assertNull(GeofenceVerifier.fetch(request()))
    }

    @Test
    fun `a slow server is given up on at the deadline`() {
        delayMs = 3000
        val started = System.currentTimeMillis()
        assertNull(GeofenceVerifier.fetchWithin(request(), deadlineMs = 300))
        assertTrue(System.currentTimeMillis() - started < 2000)
    }

    @Test
    fun `fetchWithin returns the answer in time`() {
        assertEquals(emptyMap<String, NotificationText>(), GeofenceVerifier.fetchWithin(request()))
    }

    @Test
    fun `unreachable server is unknown`() {
        val unreachable = url
        server.close()
        assertNull(GeofenceVerifier.fetch(GeofenceVerifier.Request(unreachable, null, "cs", "2026-11-10")))
    }

    @Test
    fun `a response in another shape is unknown`() {
        assertNull(GeofenceVerifier.parse("<html>Login</html>"))
        assertNull(GeofenceVerifier.parse("""{"items":[]}"""))
    }

    @Test
    fun `missing body and url are tolerated`() {
        assertEquals(
            mapOf("a" to NotificationText("Obchod", "", null)),
            GeofenceVerifier.parse("""{"geofences":[{"identifier":"a","notificationTitle":"Obchod"}]}"""),
        )
    }
}
