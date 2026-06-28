# Nexus — Mobile app & Push notifications

This covers the two delivery surfaces and how to test them:

1. **Web Push (PWA)** — real browser push on Chrome/Edge/Firefox (desktop +
   Android) and iOS 16.4+ installed as a Home-Screen PWA. Fully implemented.
2. **Native push (FCM/APNs)** — the Capacitor app registers a device token; the
   final delivery step needs a Firebase project (your credentials).

The mobile app itself is a Capacitor shell that loads the live site
(`capacitor.config.ts` → `server.url`). See **CAPACITOR.md** for build basics;
this file covers push, the native bridge, icons, and signing.

---

## 1. Web Push (PWA) — implemented end-to-end

**How it works**

- The service worker (`public/sw.js`) has `push` + `notificationclick` handlers.
- `src/lib/push.ts` registers the SW, fetches the server VAPID public key
  (`GET /api/push/vapid`), calls `pushManager.subscribe()`, and POSTs the
  subscription to `POST /api/push/subscribe`.
- The backend (`backend/app/Libraries/Push.php`) encrypts each payload (RFC 8291)
  and sends it via the VAPID-signed push request, pruning dead endpoints.
- UI: **Admin Setup → Notifications** (`PushNotificationSettings`) — enable on a
  device, see live subscription state, and **Send test** (real server push).

**Server setup**

1. Run the DB migrations so `push_subscriptions` exists — open
   `https://<your-host>/api/setup?key=<setup.key>` after deploy (per-tenant DBs
   get it when provisioned).
2. VAPID keys are **auto-generated and stored** in the `settings` table on first
   use. To pin your own (recommended for production), set in `backend/.env`:

   ```
   webpush.publicKey  = "BPb3...<87-char base64url public key>"
   webpush.privateKey = "<43-char base64url private key>"
   webpush.subject    = "mailto:admin@educationvibes.in"
   ```

   Generate a pair with:

   ```bash
   cd backend
   php -r 'require "vendor/autoload.php"; \
     $k = Minishlink\WebPush\VAPID::createVapidKeys(); \
     echo "public=".$k["publicKey"]."\nprivate=".$k["privateKey"]."\n";'
   ```

   > If that errors with "Unable to create the key", your PHP has no OpenSSL
   > config — set `OPENSSL_CONF` to a valid `openssl.cnf` (Linux hosts work out
   > of the box). The same applies to live sending.

**Requirements**

- HTTPS (or `http://localhost`). Push will not work over plain HTTP on a LAN IP.
- iOS: the user must **Add to Home Screen** in Safari first, then open that
  installed app and enable push (iOS 16.4+). Push does not work in the iOS
  Safari tab itself.

**Firing pushes on events**

Call the sender from any backend controller when something happens:

```php
use App\Libraries\Push;

Push::sendToUser($assigneeUserId, [
    'title' => 'New lead assigned',
    'body'  => $lead['name'] . ' was assigned to you',
    'url'   => '/leads',
]);
// or Push::broadcast([...]) for everyone in the workspace.
```

The event toggles on the Notifications screen are stored as preferences; wire
them into these call sites where you want them respected.

---

## 2. Native push (FCM on Android, APNs on iOS)

The app already includes `@capacitor/push-notifications`. On launch in the
native shell, `src/lib/nativePush.ts` requests permission, registers, and POSTs
the device token to `POST /api/push/device` (stored in `device_tokens`). The
Android `build.gradle` auto-applies the Google Services plugin when
`google-services.json` is present.

**What YOU must provide (Firebase):**

1. Create a Firebase project at <https://console.firebase.google.com>.
2. Add an **Android app** with package id `in.educationvibes.nexus`; download
   `google-services.json` into `frontend/android/app/`.
3. (iOS) Add an **iOS app**, download `GoogleService-Info.plist` into the Xcode
   project, and upload your **APNs key** in Firebase → Project Settings → Cloud
   Messaging.
4. `npm run mobile:sync` then rebuild.

**Delivering to FCM (backend, not yet wired):** sending to the stored
`device_tokens` requires Firebase credentials (a service-account JSON for FCM
HTTP v1). That sender is intentionally **not** implemented because it needs your
Firebase project. It plugs in alongside `App\Libraries\Push` — add a
`sendFcm($tokens, $payload)` that POSTs to
`https://fcm.googleapis.com/v1/projects/<project-id>/messages:send` with an
OAuth2 token minted from the service account. Until then, tokens are captured
and stored, and **web push works without any of this.**

---

## 3. Native shell behaviour

`src/components/MobileBridge.tsx` (mounted in the root layout) runs only inside
the Capacitor app and:

- themes the **status bar** to brand blue,
- **hides the splash screen** once the web app is interactive,
- maps the **Android hardware back button** to SPA history (exits at the root),
- initialises **native push**.

On the web it is completely inert.

### App icons & splash

PNG icons are generated in `public/` (`icon-192.png`, `icon-512.png`,
`badge-96.png`, maskable variants) and referenced by the manifest + push
notifications. To regenerate the **native launcher icon / splash** from a
1024×1024 source:

```bash
cd frontend
npm i -D @capacitor/assets
# put icon.png (+ optional splash.png) in resources/
npx capacitor-assets generate
```

---

## 4. Signed release build (Android)

`android/app/build.gradle` reads `android/keystore.properties` (gitignored).

1. Create a release keystore once:

   ```bash
   keytool -genkey -v -keystore nexus-release.jks -keyalg RSA -keysize 2048 \
     -validity 10000 -alias nexus
   ```

2. Create `frontend/android/keystore.properties`:

   ```properties
   storeFile=/absolute/path/to/nexus-release.jks
   storePassword=********
   keyAlias=nexus
   keyPassword=********
   ```

3. Build:

   ```bash
   cd frontend/android
   ./gradlew assembleRelease     # signed APK  -> app/build/outputs/apk/release/
   ./gradlew bundleRelease       # signed AAB  -> app/build/outputs/bundle/release/ (Play Store)
   ```

Without `keystore.properties`, `assembleDebug` still produces an installable
debug APK. iOS signing/IPA is done in Xcode on a Mac (Archive → Distribute).

> `android/` is regenerated by `cap add android`. If you ever recreate it,
> re-apply the `signingConfigs`/`keystore.properties` block from this repo's
> `build.gradle` (it's also documented above).

---

## 5. Test checklist (across devices)

Automated checks done in this repo: `tsc --noEmit` (frontend) and `php -l`
(backend) pass. The rest must be exercised on real targets:

**Web push (desktop Chrome/Edge):**
- [ ] Visit the deployed HTTPS site, sign in.
- [ ] Admin Setup → Notifications → **Enable on this device** → allow permission.
- [ ] **Send test** → a system notification appears; clicking it focuses the app.
- [ ] DevTools → Application → Service Workers shows `sw.js` activated; Push
      section can trigger a test push.

**Web push (Android Chrome):**
- [ ] Same as above on the phone browser; lock the screen and Send test — the
      notification arrives in the system tray.

**Web push (iOS 16.4+):**
- [ ] Safari → Share → **Add to Home Screen**; open the installed app; enable
      push; Send test.

**PWA install:**
- [ ] Desktop/Android Chrome shows the install prompt (`PwaRegister`); installed
      app launches standalone with the brand icon.

**Native app (Android, needs Firebase):**
- [ ] `npm run mobile:android`, run on a device/emulator; grant the notification
      permission; confirm a `device_tokens` row is created.
- [ ] Send a test from Firebase Console → Cloud Messaging to the device.

**Native app (iOS, needs Mac + Apple account):**
- [ ] Run from Xcode on a real device (push doesn't work in the simulator);
      grant permission; verify token registration.
