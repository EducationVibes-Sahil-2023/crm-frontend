# Nexus HRMS — Mobile app (iOS + Android via Capacitor)

The mobile app wraps this Next.js app in a native shell with
[Capacitor](https://capacitorjs.com). The native app loads your **live web app**
inside a full-screen webview, so the same UI (CRM + HRMS) runs on the phone with
no separate codebase, and every page — including dynamic ones — just works.

- **App ID:** `in.educationvibes.nexus`
- **App name:** Nexus HRMS
- **Config:** `capacitor.config.ts`

## Why "load from URL" (not a static bundle)

This app is a live, backend-driven SPA with a dynamic route (`/forms/[id]`) and
all data fetched at runtime. Capacitor's `server.url` mode loads the deployed
site, which always shows the latest UI and supports every route. (A static
`output: export` bundle can't serve dynamic routes without per-route
`generateStaticParams`, so we don't use it here.)

## Prerequisites

| Target | Needs |
| ------ | ----- |
| Android `.apk` | Android Studio + Android SDK + JDK 17 (works on Windows) |
| iOS `.ipa` | **macOS** + Xcode + CocoaPods + Apple Developer account |

> iOS cannot be built on Windows — Apple requires macOS/Xcode. Build the Android
> APK on Windows; do the iOS build on a Mac.

## 1. Deploy the web app (or use your LAN IP for testing)

Host the Next.js app somewhere reachable from the phone and put that URL in
`capacitor.config.ts` → `server.url`:

```ts
server: { url: "https://app.educationvibes.in" }
```

For quick on-device testing on the same Wi‑Fi, use your PC's LAN IP with the dev
server running (`npm run dev`):

```ts
server: { url: "http://192.168.1.54:3000", cleartext: true }
```

Also make sure the backend `NEXT_PUBLIC_API_BASE_URL` and CI4 CORS allow that
origin.

## 2. Add the native platforms (first time only)

```bash
cd frontend
npx cap add android
npx cap add ios        # macOS only
```

## 3. Sync + open the native project

```bash
npm run mobile:android   # cap sync + opens Android Studio
npm run mobile:ios       # cap sync + opens Xcode (macOS only)
```

## 4. Build the installable

- **Android APK** — Android Studio → *Build → Build APK(s)*; output in
  `android/app/build/outputs/apk/`. For the Play Store, *Generate Signed
  Bundle/APK* (AAB). CLI: `cd android && ./gradlew assembleDebug`.
- **iOS IPA** — Xcode → Generic iOS Device → *Product → Archive* → distribute
  from the Organizer.

## App icon & splash

Drop a 1024×1024 `icon.png` (and optional `splash.png`) in `resources/` and run:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate
```

## Notes

- `android/` and `ios/` are generated and gitignored.
- `mobile-shell/` is the bundled fallback shown while connecting / offline.
- After changing `server.url` or native config, re-run `npm run mobile:sync`.
