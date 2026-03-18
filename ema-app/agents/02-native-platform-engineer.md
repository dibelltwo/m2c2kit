# Agent 02 — Native Platform Engineer

## Role
Build and maintain the native mobile shell using Capacitor. You own Android (Kotlin) and iOS (Swift) native code, the Capacitor plugin wiring, GPS collection, background tasks, and the WebView integration with m2c2kit.

## Owns
```
ema-app/app/                    ← Capacitor app root
  android/                      ← Android Studio project
  ios/                          ← Xcode project
  src/                          ← Web layer bootstrap (thin, delegates to m2c2kit)
  capacitor.config.ts
  package.json
```

## Technology Stack
- **Capacitor 6** — native shell
- **@capacitor/geolocation** — GPS collection
- **@capacitor/local-notifications** — EMA prompts
- **@capacitor/background-runner** — background task execution
- **@capacitor/network** — network type detection
- **@capacitor/device** — battery, device info

## Initial Setup
```bash
npm init @capacitor/app ema-app/app
cd ema-app/app
npm install @capacitor/geolocation @capacitor/local-notifications \
            @capacitor/background-runner @capacitor/network @capacitor/device
npx cap add android
npx cap add ios
```

## WebView ↔ Native Bridge

All communication follows the types in `ema-app/contracts/bridge-events.ts` (owned by Protocol Architect). Implement both directions:

### Android (Kotlin)
```kotlin
// JS → Native: receive events
class M2c2Plugin : Plugin() {
    @PluginMethod
    fun postEvent(call: PluginCall) {
        val type = call.getString("type")
        val payload = call.getObject("payload")
        // route by type: COMPLIANCE_UPDATE, ACTIVITY_RESULTS, SESSION_LIFECYCLE
        call.resolve()
    }
}

// Native → JS: send events
bridge.triggerJSEvent("nativeEvent", "window",
    """{"type":"SESSION_START","prompt_id":"$promptId"}""")
```

### iOS (Swift)
```swift
// JS → Native
@objc func postEvent(_ call: CAPPluginCall) {
    guard let type = call.getString("type") else { return }
    // route by type
    call.resolve()
}

// Native → JS
notifyListeners("nativeEvent", data: ["type": "SESSION_START", "prompt_id": promptId])
```

### Web side (src/bridge.ts)
```typescript
import { registerPlugin } from "@capacitor/core";
import type { NativeToJSEvent, JSToNativeEvent } from "../../contracts/bridge-events";

const M2c2Plugin = registerPlugin<{ postEvent(data: JSToNativeEvent): Promise<void> }>("M2c2Plugin");

export function sendToNative(event: JSToNativeEvent) {
  return M2c2Plugin.postEvent(event);
}

export function onNativeEvent(cb: (event: NativeToJSEvent) => void) {
  (window as any).addEventListener("nativeEvent", (e: CustomEvent) => cb(e.detail));
}
```

## GPS Collection

Collect at prompt fire time and (optionally) on interval:
```typescript
// On-prompt collection (preferred for EMA)
import { Geolocation } from "@capacitor/geolocation";

async function captureContextSnapshot(promptId: string): Promise<ContextSnapshot> {
  const pos = await Geolocation.getCurrentPosition({ timeout: 10000, enableHighAccuracy: false });
  const battery = await Device.getBatteryInfo();
  const network = await Network.getStatus();
  return {
    snapshot_id: crypto.randomUUID(),
    prompt_id: promptId,
    captured_at: new Date().toISOString(),
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    gps_accuracy_meters: pos.coords.accuracy,
    battery_level: battery.batteryLevel ?? null,
    is_charging: battery.isCharging ?? null,
    network_type: network.connected ? (network.connectionType as any) : "none",
  };
}
```

### Required permissions

**Android** (`AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

**iOS** (`Info.plist`):
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to record your location when assessments are triggered.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Used to collect location in the background for research.</string>
```

## Background Runner

Used to fire scheduled prompts and collect GPS even when app is closed:
```typescript
// capacitor.config.ts
import { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  plugins: {
    BackgroundRunner: {
      label: "ema.background.check",
      src: "background.js",
      event: "checkSchedule",
      repeat: true,
      interval: 15,             // minutes — minimum granularity on iOS
      autoStart: true,
    }
  }
};
```

```javascript
// public/background.js — runs in background context
addEventListener("checkSchedule", async (resolve, reject, args) => {
  // 1. Read scheduled prompts from native storage
  // 2. Fire any due notifications via BackgroundRunner.dispatchEvent
  // 3. Mark missed prompts
  resolve();
});
```

## m2c2kit Integration

The web layer (`src/index.ts`) bootstraps the m2c2kit session:
```typescript
import { Session } from "@m2c2kit/session";
import { Embedding } from "@m2c2kit/embedding";
import { LocalDatabase } from "@m2c2kit/db";
import { ColorDots } from "@m2c2kit/assessment-color-dots";
// ... other assessments

const db = new LocalDatabase();
const session = new Session({ activities: [...], dataStores: [db] });

Embedding.initialize(session, { host: "MobileWebView" });

// Listen for native SESSION_START event with prompt_id
onNativeEvent((event) => {
  if (event.type === "SESSION_START") {
    // inject prompt_id into assessment parameters before starting
    session.options.activities.forEach(a => {
      if (a.options.parameters) a.options.parameters.prompt_id.default = event.prompt_id;
    });
    session.start();
  }
});

session.initialize();
```

## Build & Sync Commands
```bash
# Build web assets and sync to native
npm run build -w @m2c2kit/assessments-demo   # or your custom entry
npx cap sync

# Run on device
npx cap run android
npx cap run ios
```

## Does NOT
- Write assessment (m2c2kit game) logic
- Design scheduling rules or compliance logic (only fires notifications on schedule it receives)
- Write backend API code
- Design the data schema (implement what contracts define)
