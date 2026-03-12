# Capacitor Native Wrapper — Design

## Přehled

WebView shell (Capacitor) načítající sweptmind.com s nativními pluginy pro background geolokaci, push notifikace a macOS Dock chování. Cílové platformy: iOS, Android, macOS.

## Architektura

Capacitor app je tenký nativní shell s WebView, který načítá produkční web (sweptmind.com). Žádná duplikace kódu — stávající Next.js PWA běží beze změny. Nativní funkce se zpřístupňují přes Capacitor pluginy, které web app detekuje za běhu pomocí `Capacitor.isNativePlatform()`.

### Runtime platform detection

```typescript
function getPlatform(): 'web' | 'ios' | 'android' | 'electron' {
  if (window.electronAPI) return 'electron';
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() as 'ios' | 'android';
  return 'web';
}
```

Web app se chová identicky na všech platformách — rozdíl je jen v implementaci nativních služeb (push, geolokace).

## Clean Architecture — port/adapter vzor

Nativní funkce se abstrahují přes port interfaces v domain vrstvě. Každá platforma má vlastní adapter.

### Porty (interfaces)

```typescript
// packages/native-bridge/src/ports/push.port.ts
interface PushPort {
  register(): Promise<{ token: string; platform: string }>;
  onNotification(cb: (notification: PushNotification) => void): void;
}

// packages/native-bridge/src/ports/location.port.ts
interface LocationPort {
  getCurrentPosition(): Promise<Position>;
  startBackgroundTracking(config: TrackingConfig): Promise<void>;
  stopBackgroundTracking(): Promise<void>;
  addGeofence(fence: GeofenceConfig): Promise<void>;
  removeGeofence(id: string): Promise<void>;
  onGeofenceEvent(cb: (event: GeofenceEvent) => void): void;
}
```

### Adaptery

- **Web adapter:** Stávající implementace (Web Push API, navigator.geolocation)
- **Capacitor adapter:** `@capacitor/push-notifications`, `@capacitor-community/background-geolocation`
- **Electron adapter:** Electron Notification API, bez geolokace (macOS desktop)

### Factory

```typescript
function createPushAdapter(): PushPort {
  switch (getPlatform()) {
    case 'ios':
    case 'android': return new CapacitorPushAdapter();
    case 'electron': return new ElectronPushAdapter();
    default: return new WebPushAdapter();
  }
}
```

## Background geolokace a geofencing

### Strategie: hybrid (geofencing + periodické kontroly)

- **Stabilní lokace (domov, práce):** Nativní geofencing přes OS API. Vždy aktivní, minimální spotřeba baterie.
- **Ad-hoc lokace (výlety apod.):** Periodická kontrola pozice na pozadí (každých 5–15 minut), porovnání s uloženými lokacemi tasků.

### iOS geofence limit

iOS povoluje max ~20 geofencí. Řešení — prioritizace:

1. Stabilní lokace (domov, práce) mají nejvyšší prioritu
2. Zbývající sloty pro ad-hoc lokace s nejbližším dueDate
3. Pokud je lokací víc než 20, zbytek pokrývá periodická kontrola

### Deduplikace notifikací

- Backend eviduje `lastNotifiedAt` per task per lokace
- Cooldown 1 hodina — stejný task na stejné lokaci se nenotifikuje častěji
- Při opuštění geofence se cooldown resetuje

### Bateriová optimalizace

- Geofencing: ~0% extra spotřeba (OS level, hardwarový coprocessor)
- Periodické kontroly: significant motion API jako trigger místo fixního intervalu
- Uživatel může v Settings vypnout background tracking

## Push notifikace — hybridní model

### Architektura

- **Webový prohlížeč:** Stávající Web Push (VAPID) — beze změny
- **Capacitor (iOS/Android):** Nativní push přes APNs/FCM

### Backend

Rozšíření `push_subscriptions` tabulky:

```sql
ALTER TABLE push_subscriptions ADD COLUMN platform TEXT DEFAULT 'web';
-- platform: 'web' | 'ios' | 'android'
```

- `web`: stávající VAPID endpoint + keys
- `ios`/`android`: device token v `endpoint` sloupci

### Send logika

```typescript
async function sendPush(subscription: PushSubscription, payload: PushPayload) {
  if (subscription.platform === 'web') {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } else {
    await firebaseAdmin.messaging().send({
      token: subscription.endpoint, // device token
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
  }
}
```

Firebase Admin SDK posílá na FCM (Android) i APNs (iOS) přes jedno API.

### Registrace v Capacitor app

```typescript
// Capacitor push adapter
async register(): Promise<{ token: string; platform: string }> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') throw new Error('Push denied');
  await PushNotifications.register();
  const token = await new Promise<string>((resolve) => {
    PushNotifications.addListener('registration', (t) => resolve(t.value));
  });
  return { token, platform: Capacitor.getPlatform() };
}
```

## macOS-specifické chování

### Dock persistence

Electron wrapper na macOS schová okno místo ukončení při zavření červeným tlačítkem:

```typescript
mainWindow.on('close', (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});

app.on('activate', () => mainWindow.show());
app.on('before-quit', () => { app.isQuitting = true; });
```

Cmd+Q skutečně ukončí aplikaci.

### Menu bar

Standardní macOS menu (About, Quit, Edit s Copy/Paste). Žádné custom položky v MVP.

### Distribuce

- Bez Apple Developer účtu: `.dmg` nebo `.app` zip
- Gatekeeper warning — uživatel povolí v System Settings
- Později s účtem: notarizace + Mac App Store

## Projektová struktura

```
sweptmind/
├── apps/
│   ├── mobile/                    # Capacitor (iOS + Android)
│   │   ├── capacitor.config.ts
│   │   ├── android/               # Auto-generated
│   │   ├── ios/                   # Auto-generated
│   │   └── src/
│   │       ├── plugins/
│   │       └── index.ts
│   └── desktop/                   # Electron (macOS)
│       ├── electron-builder.yml
│       ├── src/
│       │   ├── main.ts
│       │   └── preload.ts
│       └── package.json
├── packages/
│   └── native-bridge/
│       ├── src/
│       │   ├── ports/
│       │   │   ├── push.port.ts
│       │   │   ├── location.port.ts
│       │   │   └── biometrics.port.ts
│       │   ├── adapters/
│       │   │   ├── web/
│       │   │   ├── capacitor/
│       │   │   └── electron/
│       │   └── index.ts
│       └── package.json
└── src/                           # Next.js app (beze změny)
```

### Build pipeline

- **Android:** `npx cap sync android && ./gradlew assembleDebug` → `.apk`
- **iOS:** `npx cap sync ios` → Xcode build
- **macOS:** `npm run build` v `apps/desktop` → `.dmg` via electron-builder
- **CI (později):** GitHub Actions při tagu

### Capacitor config

```typescript
const config: CapacitorConfig = {
  appId: 'com.sweptmind.app',
  appName: 'SweptMind',
  server: {
    url: 'https://sweptmind.com',
    cleartext: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};
```

## Testovací strategie

### Unit testy (Vitest)

- Port interfaces — testování kontraktů
- Platform detection — mockování `Capacitor.isNativePlatform()` a `window.electronAPI`
- Adapter factory — ověření správné implementace pro platformu

### Integrační testy

- Capacitor push adapter — mockovaný `@capacitor/push-notifications`
- Capacitor geolocation adapter — mockovaný `@capacitor-community/background-geolocation`
- Electron adapter — mockovaný Electron IPC

### E2E / manuální QA

- iOS Simulator: geolokace ano, push ne
- Android Emulator: push i geolokace
- macOS: Dock behavior, window close/reopen
- Push delivery a background geolocation na reálném HW — manuálně

### Backend testy

- Firebase Admin SDK send logic — unit test s mockovaným SDK
- Rozšířený subscribe endpoint — test pro device token s platformou
