# Background Location Tracking & Location-Based Push Notifications

**Datum:** 2026-03-20
**Stav:** Draft v2

## Motivace

Appka má úkoly vázané na lokace (tasks → locationId → locations tabulka). Uživatel potřebuje dostat push notifikaci, když se přiblíží k místu s přiřazeným úkolem — i když je appka zavřená.

## Aktuální stav

- **LocationPort** existuje s `startBackgroundTracking()`, `addGeofence()`, `onGeofenceEvent()`
- **CapacitorLocationAdapter** volá `registerPlugin("BackgroundGeolocation")` — plugin neexistuje, je to mrtvý kód
- **Geofencing** je client-side Haversine výpočet — funguje jen na popředí
- **Push notifikace** fungují (Web Push VAPID + FCM/APNs přes Firebase Admin)
- **NearbyProvider** spouští foreground tracking s 10min intervalem a 100m distance filtrem
- **Vercel Cron** `/api/push/send` posílá notifikace jen pro dueDate úkoly

## Zvolené řešení: Vlastní Capacitor plugin ($0)

Vlastní tenký nativní wrapper nad OS geofencing APIs:

| Platforma | Nativní API | Odhad kódu |
|-----------|------------|-------------|
| **iOS** | `CLLocationManager` + `CLCircularRegion` + `UNLocationNotificationTrigger` | ~200 řádků Swift |
| **Android** | `GeofencingClient` + `GeofenceBroadcastReceiver` + `NotificationManager` | ~250 řádků Kotlin |
| **TypeScript** | Capacitor plugin definitions + web fallback | ~100 řádků |

### Proč ne Transistorsoft ($399+)

- Vlastní plugin je zdarma a stačí pro náš use case
- OS-level geofencing má nulovou spotřebu baterie (pasivní monitoring přes cell towers + WiFi)
- `UNLocationNotificationTrigger` (iOS) zobrazí notifikaci bez jakéhokoli kódu běžícího na pozadí
- Na Androidu `BroadcastReceiver` zobrazí notifikaci přímo z nativního kódu
- Nepotřebujeme continuous tracking, jen geofence enter/exit
- Limit 20 geofencí (iOS) / 100 (Android) stačí — kolik uživatelů má 20+ lokací s aktivními úkoly?

### Klíčový architektonický insight: Lokální notifikace bez serveru

Místo: GPS tracking → JS Haversine → server report → FCM push
Nově: **OS registruje geofence → OS detekuje vstup → nativní kód zobrazí lokální notifikaci**

- Appka nemusí běžet
- Žádný internet potřeba pro notifikaci
- Nulová spotřeba baterie navíc
- Server report volitelně (pro analytics/sync, ne pro notifikaci)

### Referencní implementace (open-source)

| Zdroj | Kód | Relevance |
|-------|-----|-----------|
| Expo `expo-location` iOS | `EXGeofencingTaskConsumer.m` (~215 řádků) | Kompletní iOS geofencing |
| Expo `expo-location` Android | `GeofencingTaskConsumer.kt` (~245 řádků) | Kompletní Android geofencing |
| `@rn-org/react-native-geofencing` | Swift + Kotlin | Čistá moderní API reference |
| `jaimbox/capacitor-geofence-box-tracker` | Swift (~290 řádků) | Capacitor plugin struktura |
| Android docs | `developer.android.com/develop/sensors-and-location/location/geofencing` | Oficiální Kotlin snippety |

### Nativní API limity

| | iOS | Android |
|---|---|---|
| Max geofencí | 20 | 100 |
| Min radius | ~200m (doporučeno) | 100-150m |
| Latence | Sekundy–minuty | <2 min (2-3 min s bg limits Android 8+) |
| Po rebootu | Automaticky přežije | Nutná re-registrace (BOOT_COMPLETED) |
| Bez appky | Funguje (OS monitoruje) | Funguje (BroadcastReceiver) |

---

## Fáze 0: Dokumentační discovery (HOTOVO)

### Allowed APIs (ověřeno z dokumentace)

**iOS (CoreLocation + UserNotifications):**

| API | Účel |
|-----|------|
| `CLLocationManager.startMonitoring(for: CLCircularRegion)` | Registrace geofence |
| `CLLocationManager.stopMonitoring(for: CLCircularRegion)` | Odebrání geofence |
| `CLLocationManagerDelegate.didEnterRegion(_:)` | Geofence enter callback |
| `CLLocationManagerDelegate.didExitRegion(_:)` | Geofence exit callback |
| `CLLocationManager.monitoredRegions` | Seznam aktivních geofencí |
| `CLLocationManager.requestAlwaysAuthorization()` | Always permission |
| `UNLocationNotificationTrigger(region:repeats:)` | Lokální notifikace při vstupu do zóny |
| `UNUserNotificationCenter.add(_:)` | Registrace lokální notifikace |

**Android (Google Play Services + NotificationManager):**

| API | Účel |
|-----|------|
| `GeofencingClient.addGeofences(request, pendingIntent)` | Registrace geofencí |
| `GeofencingClient.removeGeofences(ids)` | Odebrání geofencí |
| `Geofence.Builder().setCircularRegion(lat, lng, radius)` | Definice geofence |
| `GEOFENCE_TRANSITION_ENTER / EXIT / DWELL` | Typy přechodů |
| `BroadcastReceiver.onReceive()` | Callback pro geofence eventy |
| `NotificationManagerCompat.notify()` | Zobrazení lokální notifikace |

**Capacitor Plugin API:**

| API | Účel |
|-----|------|
| `@CapacitorPlugin` / `CAPPlugin` | Plugin registrace |
| `@PluginMethod` / `@objc func` | Bridge metody |
| `notifyListeners(eventName, data)` | JS event callback |
| `registerPlugin()` v TypeScript | JS-side registrace |

### Anti-patterns

- **NEPOUŽÍVAT** `registerPlugin("BackgroundGeolocation")` bez nativní implementace — aktuální mrtvý kód
- **NESPOLÉHAT** na client-side Haversine pro background — OS zastaví JS execution
- **NENASTAVOVAT** radius < 200m na iOS — CLCircularRegion má minimální přesnost ~200m
- **NEZAPOMÍNAT** re-registrovat geofence po Android reboot (BOOT_COMPLETED receiver)
- **NEPOUŽÍVAT** continuous GPS tracking pro geofencing — zbytečně žere baterku
- **NEKOMBINOVAT** `UNLocationNotificationTrigger` s vlastním background kódem na iOS — trigger je self-contained

---

## Fáze 1: Vytvoření vlastního Capacitor pluginu

### Úkoly

#### 1.1 Scaffold plugin

```bash
# Vytvořit plugin v packages/
cd packages
npm init @capacitor/plugin@latest
# Name: capacitor-geofence
# Package ID: @sweptmind/capacitor-geofence
# Class Name: GeofencePlugin
```

Výsledná struktura:

```
packages/capacitor-geofence/
├── src/
│   ├── definitions.ts      # TypeScript interface
│   ├── index.ts             # Export + registerPlugin()
│   └── web.ts               # Web fallback (no-op)
├── ios/Sources/GeofencePlugin/
│   ├── GeofencePlugin.swift         # CAPPlugin bridge (~80 řádků)
│   └── GeofenceManager.swift        # CLLocationManager wrapper (~120 řádků)
├── android/src/main/java/com/sweptmind/geofence/
│   ├── GeofencePlugin.kt            # @CapacitorPlugin bridge (~80 řádků)
│   ├── GeofenceManager.kt           # GeofencingClient wrapper (~90 řádků)
│   └── GeofenceBroadcastReceiver.kt # BroadcastReceiver (~80 řádků)
├── package.json
└── tsconfig.json
```

#### 1.2 TypeScript definitions

Soubor: `packages/capacitor-geofence/src/definitions.ts`

```typescript
export interface GeofencePlugin {
  /**
   * Zaregistruje geofence zóny. Na iOS současně vytvoří
   * UNLocationNotificationTrigger pro lokální notifikace.
   */
  addGeofences(options: {
    geofences: GeofenceConfig[];
  }): Promise<void>;

  /**
   * Odebere geofence podle identifierů.
   */
  removeGeofences(options: {
    identifiers: string[];
  }): Promise<void>;

  /**
   * Odebere všechny geofence.
   */
  removeAllGeofences(): Promise<void>;

  /**
   * Vrátí seznam aktuálně monitorovaných geofencí.
   */
  getMonitoredGeofences(): Promise<{
    geofences: GeofenceConfig[];
  }>;

  /**
   * Požádá o "Always" location permission.
   * Na webu vrací "denied".
   */
  requestAlwaysPermission(): Promise<{
    status: "always" | "whenInUse" | "denied";
  }>;

  /**
   * Vrátí aktuální stav location permission.
   */
  getPermissionStatus(): Promise<{
    status: "always" | "whenInUse" | "denied" | "notDetermined";
  }>;

  /**
   * Listener pro geofence přechody (enter/exit).
   * Volá se jen když je appka na popředí nebo pozadí (ne terminated).
   * Pro terminated stav se spoléháme na lokální notifikace.
   */
  addListener(
    eventName: "geofenceTransition",
    callback: (event: GeofenceTransitionEvent) => void,
  ): Promise<{ remove: () => void }>;
}

export interface GeofenceConfig {
  /** Unikátní identifier, např. "location:abc123" */
  identifier: string;
  latitude: number;
  longitude: number;
  /** Radius v metrech (min 200 doporučeno) */
  radiusMeters: number;
  /** Notifikovat při vstupu (default true) */
  notifyOnEntry?: boolean;
  /** Notifikovat při odchodu (default false) */
  notifyOnExit?: boolean;
  /** Titulek lokální notifikace při vstupu */
  notificationTitle?: string;
  /** Text lokální notifikace při vstupu */
  notificationBody?: string;
}

export interface GeofenceTransitionEvent {
  /** Identifier geofence */
  identifier: string;
  /** Typ přechodu */
  type: "enter" | "exit";
  /** Pozice při přechodu */
  latitude: number;
  longitude: number;
}
```

#### 1.3 iOS implementace — GeofencePlugin.swift

Soubor: `packages/capacitor-geofence/ios/Sources/GeofencePlugin/GeofencePlugin.swift`

```swift
import Capacitor
import CoreLocation
import UserNotifications

@objc(GeofencePlugin)
public class GeofencePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GeofencePlugin"
    public let jsName = "Geofence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMonitoredGeofences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlwaysPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
    ]

    private let manager = GeofenceManager()

    // Bridge metody volají GeofenceManager...
    // Deleguje na manager.addGeofences(), manager.removeGeofences() atd.
    // manager.onTransition = { [weak self] event in
    //     self?.notifyListeners("geofenceTransition", data: event.toDict())
    // }
}
```

#### 1.4 iOS implementace — GeofenceManager.swift

Soubor: `packages/capacitor-geofence/ios/Sources/GeofencePlugin/GeofenceManager.swift`

Klíčová logika:

```swift
class GeofenceManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private let notificationCenter = UNUserNotificationCenter.current()
    var onTransition: ((GeofenceTransitionEvent) -> Void)?

    func addGeofences(_ configs: [GeofenceConfig]) {
        for config in configs {
            // 1. Registrovat CLCircularRegion pro monitoring
            let region = CLCircularRegion(
                center: CLLocationCoordinate2D(latitude: config.latitude, longitude: config.longitude),
                radius: max(config.radiusMeters, 200),
                identifier: config.identifier
            )
            region.notifyOnEntry = config.notifyOnEntry ?? true
            region.notifyOnExit = config.notifyOnExit ?? false
            locationManager.startMonitoring(for: region)

            // 2. Registrovat UNLocationNotificationTrigger pro lokální notifikace
            //    (funguje i když appka neběží — OS sám zobrazí notifikaci)
            if let title = config.notificationTitle {
                let content = UNMutableNotificationContent()
                content.title = title
                content.body = config.notificationBody ?? ""
                content.sound = .default

                let trigger = UNLocationNotificationTrigger(region: region, repeats: true)
                let request = UNNotificationRequest(
                    identifier: "geofence-\(config.identifier)",
                    content: content,
                    trigger: trigger
                )
                notificationCenter.add(request)
            }
        }
    }

    // CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circular = region as? CLCircularRegion else { return }
        onTransition?(.init(identifier: circular.identifier, type: "enter",
                           latitude: circular.center.latitude,
                           longitude: circular.center.longitude))
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard let circular = region as? CLCircularRegion else { return }
        onTransition?(.init(identifier: circular.identifier, type: "exit",
                           latitude: circular.center.latitude,
                           longitude: circular.center.longitude))
    }
}
```

#### 1.5 Android implementace — GeofencePlugin.kt

Soubor: `packages/capacitor-geofence/android/src/main/java/com/sweptmind/geofence/GeofencePlugin.kt`

```kotlin
@CapacitorPlugin(name = "Geofence")
class GeofencePlugin : Plugin() {
    private lateinit var geofenceManager: GeofenceManager

    override fun load() {
        geofenceManager = GeofenceManager(context)
        geofenceManager.onTransition = { event ->
            notifyListeners("geofenceTransition", JSObject().apply {
                put("identifier", event.identifier)
                put("type", event.type)
                put("latitude", event.latitude)
                put("longitude", event.longitude)
            })
        }
    }

    @PluginMethod
    fun addGeofences(call: PluginCall) {
        val geofences = call.getArray("geofences") // parse...
        geofenceManager.addGeofences(geofences)
        call.resolve()
    }

    // removeGeofences, removeAllGeofences, getMonitoredGeofences,
    // requestAlwaysPermission, getPermissionStatus...
}
```

#### 1.6 Android implementace — GeofenceManager.kt

```kotlin
class GeofenceManager(private val context: Context) {
    private val geofencingClient = LocationServices.getGeofencingClient(context)
    var onTransition: ((GeofenceTransitionEvent) -> Unit)? = null

    fun addGeofences(configs: List<GeofenceConfig>) {
        val geofenceList = configs.map { config ->
            Geofence.Builder()
                .setRequestId(config.identifier)
                .setCircularRegion(config.latitude, config.longitude,
                    maxOf(config.radiusMeters, 200f))
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(
                    Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                .build()
        }

        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofenceList)
            .build()

        geofencingClient.addGeofences(request, geofencePendingIntent)

        // Uložit notifikační texty do SharedPreferences
        // pro GeofenceBroadcastReceiver
        configs.forEach { config ->
            if (config.notificationTitle != null) {
                prefs.edit().putString("geofence:${config.identifier}:title",
                    config.notificationTitle).apply()
                prefs.edit().putString("geofence:${config.identifier}:body",
                    config.notificationBody).apply()
            }
        }
    }
}
```

#### 1.7 Android implementace — GeofenceBroadcastReceiver.kt

```kotlin
class GeofenceBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) return

        val type = when (event.geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> "enter"
            Geofence.GEOFENCE_TRANSITION_EXIT -> "exit"
            else -> return
        }

        for (geofence in event.triggeringGeofences ?: emptyList()) {
            // Zobrazit lokální notifikaci (funguje i bez běžící appky)
            val prefs = context.getSharedPreferences("geofence_notifications", 0)
            val title = prefs.getString("geofence:${geofence.requestId}:title", null) ?: continue
            val body = prefs.getString("geofence:${geofence.requestId}:body", "")

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(/* PendingIntent otevře appku na /context */)
                .build()

            NotificationManagerCompat.from(context).notify(
                geofence.requestId.hashCode(), notification)
        }
    }
}
```

#### 1.8 Android — re-registrace po rebootu

```kotlin
// AndroidManifest.xml:
// <receiver android:name=".BootReceiver" android:exported="true">
//   <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/></intent-filter>
// </receiver>

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Načíst uložené geofence z SharedPreferences a znovu registrovat
            GeofenceManager(context).restoreGeofences()
        }
    }
}
```

#### 1.9 AndroidManifest.xml — permissions

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Ověření

- [ ] `npm init @capacitor/plugin` scaffold proběhne
- [ ] Xcode build s GeofencePlugin projde
- [ ] Android build s GeofencePlugin projde
- [ ] `addGeofences()` z JS zaregistruje geofence (ověřit v `monitoredRegions` / logcat)
- [ ] `UNLocationNotificationTrigger` na iOS zobrazí notifikaci při simulovaném vstupu do zóny
- [ ] `GeofenceBroadcastReceiver` na Androidu zobrazí notifikaci
- [ ] `geofenceTransition` event dorazí do JS když je appka na popředí

---

## Fáze 2: Nativní konfigurace a integrace s mobile app

### Úkoly

#### 2.1 Srovnání verze Capacitor v native-bridge

`packages/native-bridge/package.json` má `@capacitor/core: ^8.2.0` v devDependencies — srovnat na `^6` aby odpovídal `apps/mobile/`.

#### 2.2 Přidat plugin jako dependency do mobile app

```bash
# V apps/mobile/package.json přidat:
"@sweptmind/capacitor-geofence": "file:../../packages/capacitor-geofence"
```

#### 2.3 iOS Info.plist — background modes a permission strings

Soubor: `apps/mobile/ios/App/App/Info.plist`

```xml
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>remote-notification</string>
</array>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>SweptMind potřebuje přístup k poloze na pozadí pro upozornění na úkoly v blízkosti.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>SweptMind potřebuje přístup k poloze pro zobrazení úkolů v blízkosti.</string>
```

Pozn: `fetch` background mode NENÍ potřeba (nemáme background-fetch plugin). `NSMotionUsageDescription` NENÍ potřeba (nepoužíváme activity recognition).

#### 2.4 Sync a build test

```bash
cd apps/mobile && npx cap sync ios && npx cap sync android
cd apps/mobile && npx cap open ios  # ověřit build v Xcode
```

### Ověření

- [ ] `npx cap sync ios` proběhne bez chyb
- [ ] `npx cap sync android` proběhne bez chyb
- [ ] Xcode build projde
- [ ] Android Studio build projde
- [ ] Info.plist obsahuje `UIBackgroundModes` s `location`, `remote-notification`
- [ ] Podfile obsahuje GeofencePlugin pod

---

## Fáze 3: Přepis Capacitor location adaptéru

### Úkoly

#### 3.1 Aktualizace typů

Soubor: `packages/native-bridge/src/types.ts`

Přidat `"dwell"` do `GeofenceEvent.type`, přidat `extras`:

```typescript
export interface GeofenceEvent {
  fenceId: string;
  type: "enter" | "exit";
  position: Position;
}

export interface GeofenceRegistration {
  identifier: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  notificationTitle?: string;
  notificationBody?: string;
}
```

#### 3.2 Rozšíření LocationPort

Soubor: `packages/native-bridge/src/ports/location.port.ts`

```typescript
export interface LocationPort {
  // Existující metody ponechat pro zpětnou kompatibilitu
  isSupported(): boolean;
  getCurrentPosition(): Promise<Position>;
  startBackgroundTracking(config: TrackingConfig): Promise<void>;
  stopBackgroundTracking(): Promise<void>;
  addGeofence(fence: GeofenceConfig): Promise<void>;
  removeGeofence(id: string): Promise<void>;
  onGeofenceEvent(cb: (event: GeofenceEvent) => void): () => void;

  // Nové metody
  requestAlwaysPermission(): Promise<"always" | "whenInUse" | "denied">;
  getPermissionStatus(): Promise<"always" | "whenInUse" | "denied" | "notDetermined">;
  syncGeofences(fences: GeofenceRegistration[]): Promise<void>;
  removeAllGeofences(): Promise<void>;
}
```

#### 3.3 Přepis CapacitorLocationAdapter

Soubor: `packages/native-bridge/src/adapters/capacitor/capacitor-location.adapter.ts`

Nahradit celý soubor. Klíčové změny:

```typescript
import { Geolocation } from "@capacitor/geolocation";
import { registerPlugin } from "@capacitor/core";
import type { GeofencePlugin } from "@sweptmind/capacitor-geofence";

const GeofenceNative = registerPlugin<GeofencePlugin>("Geofence");
```

| Metoda | Implementace |
|--------|-------------|
| `getCurrentPosition()` | `Geolocation.getCurrentPosition()` (stávající `@capacitor/geolocation`) |
| `startBackgroundTracking()` | No-op (nepotřebujeme continuous tracking) |
| `stopBackgroundTracking()` | No-op |
| `addGeofence(fence)` | `GeofenceNative.addGeofences({ geofences: [mapped] })` |
| `removeGeofence(id)` | `GeofenceNative.removeGeofences({ identifiers: [id] })` |
| `syncGeofences(fences)` | `removeAllGeofences()` + `addGeofences()` |
| `removeAllGeofences()` | `GeofenceNative.removeAllGeofences()` |
| `onGeofenceEvent(cb)` | `GeofenceNative.addListener("geofenceTransition", ...)` |
| `requestAlwaysPermission()` | `GeofenceNative.requestAlwaysPermission()` |
| `getPermissionStatus()` | `GeofenceNative.getPermissionStatus()` |

#### 3.4 Aktualizace WebLocationAdapter

Soubor: `packages/native-bridge/src/adapters/web/web-location.adapter.ts`

Nové metody jako no-op:

```typescript
async requestAlwaysPermission() { return "denied" as const; }
async getPermissionStatus() { return "denied" as const; }
async syncGeofences() { /* no-op — web nemá geofencing */ }
async removeAllGeofences() { /* no-op */ }
```

### Ověření

- [ ] `yarn typecheck` v `packages/native-bridge/` projde
- [ ] Na iOS: `addGeofence()` zaregistruje region (ověřit `locationManager.monitoredRegions`)
- [ ] Na iOS: `UNLocationNotificationTrigger` se zaregistruje
- [ ] Na Androidu: `GeofencingClient.addGeofences()` proběhne bez chyby
- [ ] `onGeofenceEvent()` callback se zavolá při simulovaném geofence vstupu

---

## Fáze 4: Propojení s NearbyProvider a geofence sync

### Úkoly

#### 4.1 Geofence sync hook

Nový hook: `src/hooks/use-geofence-sync.ts`

```typescript
/**
 * Synchronizuje nativní geofence s uživatelskými lokacemi.
 * Volá se při:
 * - Startu appky (na iOS/Android)
 * - Změně lokací nebo úkolů vázaných na lokace
 *
 * Transformuje Location[] → GeofenceRegistration[] s lokálními
 * notifikačními texty (počet úkolů, názvy).
 */
export function useGeofenceSync(
  locations: Location[],
  tasksWithLocation: Task[],
  platform: Platform,
) {
  useEffect(() => {
    if (platform !== "ios" && platform !== "android") return;

    const adapter = getLocationAdapter();

    // Lokace, které mají alespoň 1 aktivní (nedokončený) úkol
    const activeLocations = locations.filter((loc) =>
      tasksWithLocation.some((t) => t.locationId === loc.id && !t.isCompleted)
    );

    const registrations: GeofenceRegistration[] = activeLocations.map((loc) => {
      const tasks = tasksWithLocation.filter(
        (t) => t.locationId === loc.id && !t.isCompleted
      );
      return {
        identifier: `location:${loc.id}`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusMeters: Math.max(loc.radius * 1000, 200), // km → m, min 200m
        notificationTitle: `Úkoly v blízkosti: ${loc.name}`,
        notificationBody:
          tasks.length === 1
            ? tasks[0].title
            : `${tasks[0].title} a ${tasks.length - 1} další`,
      };
    });

    adapter.syncGeofences(registrations);
  }, [locations, tasksWithLocation, platform]);
}
```

#### 4.2 Volitelný geofence event handler (pro foreground sync)

Nový hook: `src/hooks/use-geofence-events.ts`

```typescript
/**
 * Poslouchá geofence eventy když je appka na popředí.
 * Volitelně reportuje na server pro analytics a cross-device sync.
 * Lokální notifikace se řeší nativně (bez tohoto hooku).
 */
export function useGeofenceEvents(platform: Platform) {
  useEffect(() => {
    if (platform !== "ios" && platform !== "android") return;

    const adapter = getLocationAdapter();
    const unsub = adapter.onGeofenceEvent(async (event) => {
      if (event.type === "enter") {
        // Volitelný server report (pro analytics, ne pro notifikaci)
        try {
          await fetch("/api/location/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locationId: event.fenceId.replace("location:", ""),
              type: event.type,
              position: event.position,
            }),
          });
        } catch {
          // Offline — nevadí, notifikace se zobrazila lokálně
        }
      }
    });

    return unsub;
  }, [platform]);
}
```

#### 4.3 Aktualizace NearbyProvider

Soubor: `src/components/providers/nearby-provider.tsx`

Změny:

1. Nahradit `startBackgroundTracking()` za `useGeofenceSync()` pro registraci geofencí
2. Přidat `useGeofenceEvents()` pro foreground event handling
3. Foreground `getCurrentPosition()` ponechat pro UI (blízké seznamy, pulsující indikátor)
4. Odebrat 10min interval + 100m distance filter (nepotřebujeme continuous tracking)

#### 4.4 Permission flow

Aktualizovat NearbyProvider nebo Settings:

```typescript
const startGeofencing = async () => {
  const adapter = getLocationAdapter();
  const status = await adapter.getPermissionStatus();

  if (status === "notDetermined" || status === "whenInUse") {
    const result = await adapter.requestAlwaysPermission();
    if (result === "denied") {
      // Ukázat vysvětlení + odkaz do nastavení
      return;
    }
  }

  // Permission OK → sync geofences
};
```

### Ověření

- [ ] Po startu appky na iOS/Android: geofence jsou registrované pro všechny lokace s aktivními úkoly
- [ ] Přidání úkolu s lokací → nový geofence se zaregistruje
- [ ] Dokončení všech úkolů na lokaci → geofence se odebere
- [ ] Po zavření appky a vstupu do geofence zóny → lokální notifikace se zobrazí
- [ ] Klik na notifikaci → appka se otevře na `/context`
- [ ] Bez internet připojení → lokální notifikace funguje

---

## Fáze 5: Server-side sync a analytics (volitelná)

Tato fáze je **volitelná pro MVP** — lokální notifikace z Fáze 1-4 fungují bez serveru. Server-side logika je potřeba jen pro:
- Cross-device sync (úkol přidaný na webu → geofence na mobilu)
- Analytics (kolikrát uživatel prošel kolem lokace)
- Přesnější notifikační texty (aktuální počet úkolů, ne cached)

### Úkoly

#### 5.1 API endpoint: GET /api/location/geofences

Soubor: `src/app/api/location/geofences/route.ts`

```typescript
// GET /api/location/geofences
// Auth: session required
// Response: { geofences: GeofenceRegistration[] }
// Vrátí všechny lokace s aktivními (nedokončenými) úkoly,
// včetně notifikačních textů v uživatelově jazyce.
```

Použití: Appka zavolá při startu a při změně úkolů, aby sync geofence reflektoval aktuální stav ze serveru (ne jen lokální Apollo cache).

#### 5.2 API endpoint: POST /api/location/report (analytics)

Soubor: `src/app/api/location/report/route.ts`

```typescript
// POST /api/location/report
// Auth: session required
// Body: { locationId: string, type: "enter" | "exit", position: { lat, lng } }
// Response: { ok: true }
// Rate limit: 10 reportů/min/user
```

Volitelné — jen pro analytics. Notifikace se řeší lokálně.

#### 5.3 Geofence re-sync při změně úkolů na jiném zařízení

Když uživatel přidá úkol s lokací na webu, mobil potřebuje aktualizovat geofence. Řešení:
- Při otevření appky: fetch `/api/location/geofences` a sync
- Při push notifikaci typu `task_shared` / shared task change: re-sync geofence

### Ověření

- [ ] `GET /api/location/geofences` vrací správné lokace s aktivními úkoly
- [ ] Přidání úkolu na webu → při dalším otevření mobilu se geofence aktualizuje
- [ ] `POST /api/location/report` rate limit funguje

---

## Fáze 6: Finální integrace a testování

### Úkoly

#### 6.1 E2E test scénáře

1. **Happy path:** Přidat úkol s lokací → zavřít appku → přijít na místo → lokální notifikace
2. **Offline:** Vypnout internet → přijít na místo → lokální notifikace (bez server round-trip)
3. **Multi-task:** 3 úkoly na stejné lokaci → 1 notifikace "Task A a 2 další"
4. **Completed task:** Dokončit úkol → přijít na místo → žádná notifikace (geofence odregistrován)
5. **Permission denied:** Odepřít "always" → appka degraduje na foreground-only
6. **No location tasks:** Žádné úkoly s lokací → žádné geofence registrované
7. **Android reboot:** Restartovat telefon → geofence se obnoví → notifikace fungují
8. **iOS kill:** Force-quit appka → UNLocationNotificationTrigger stále funguje

#### 6.2 i18n

Přidat do slovníků (`src/lib/i18n/dictionaries/`):

```typescript
// cs
locationNotification: {
  title: "Úkoly v blízkosti: {location}",
  bodyOne: "{title}",
  bodyMany: "{title} a {remaining} další",
  permissionTitle: "Poloha na pozadí",
  permissionDescription: "Povolte přístup k poloze \"Vždy\" pro upozornění na úkoly v blízkosti.",
  permissionButton: "Otevřít nastavení",
}

// en
locationNotification: {
  title: "Tasks nearby: {location}",
  bodyOne: "{title}",
  bodyMany: "{title} and {remaining} more",
  permissionTitle: "Background Location",
  permissionDescription: "Allow \"Always\" location access to receive notifications about nearby tasks.",
  permissionButton: "Open Settings",
}
```

#### 6.3 Monitoring a debugging

- Logovat počet registrovaných geofencí v dev mode
- Na iOS: ověřit v Settings → Privacy → Location Services → SweptMind → "Always"
- Na Androidu: `adb shell dumpsys location` pro ověření geofencí

### Ověření

- [ ] `yarn check` projde (lint + format + typecheck + test)
- [ ] iOS build na TestFlight
- [ ] Android debug build funguje
- [ ] Lokální notifikace přijdou spolehlivě při příchodu na lokaci
- [ ] Notifikace fungují i bez internetu
- [ ] Notifikace fungují i po zavření/killu appky
- [ ] Baterie: žádný významný drain

---

## Souhrn fází

| Fáze | Popis | Odhad kódu | Soubory |
|------|-------|------------|---------|
| 1 | Vlastní Capacitor geofence plugin | ~550 řádků (Swift + Kotlin + TS) | `packages/capacitor-geofence/` |
| 2 | Nativní config + integrace s mobile app | Konfigurace | `apps/mobile/`, `Info.plist` |
| 3 | Přepis location adaptéru v native-bridge | ~150 řádků | `packages/native-bridge/` |
| 4 | NearbyProvider + geofence sync/eventy | ~200 řádků | `src/hooks/`, `src/components/providers/` |
| 5 | Server-side sync a analytics (volitelná) | ~150 řádků | `src/app/api/location/` |
| 6 | Integrace, i18n, testování | ~50 řádků + testy | slovníky, E2E |

## Rizika

| Riziko | Mitigace |
|--------|----------|
| iOS limit 20 geofencí | Stačí pro většinu uživatelů. Pokud ne → registrovat jen nejbližších 20 (sort by distance) |
| Android limit 100 geofencí | Velmi pravděpodobně nikdy nedosáhneme |
| Geofence min radius ~200m | Akceptovatelné pro většinu lokací (obchody, kanceláře, oblasti) |
| Re-registrace po Android rebootu | BootReceiver + SharedPreferences persistence |
| Nativní kód údržba (Swift + Kotlin) | Malý scope (~450 řádků), stabilní OS APIs, minimální changes potřeba |
| `UNLocationNotificationTrigger` neaktualizuje text | Re-sync geofence při změně úkolů (Fáze 4) |

## Náklady

| Položka | Cena |
|---------|------|
| Plugin vývoj | $0 (vlastní kód) |
| Licence | $0 (nativní OS APIs) |
| Provoz | $0 (lokální notifikace, žádný server round-trip potřeba) |
| **Celkem** | **$0** |
