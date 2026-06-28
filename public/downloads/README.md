# App download files

The **App Downloads** page (`/downloads`) serves the mobile builds from this
folder. Drop the compiled binaries here using these exact file names and the
download buttons turn on automatically (a `HEAD` check decides "Download" vs
"coming soon"):

| App | Android | iOS |
| --- | --- | --- |
| Nexus CRM | `nexus-crm.apk` | `nexus-crm.ipa` |
| Nexus Call Tracker | `nexus-call-tracker.apk` | `nexus-call-tracker.ipa` |

## Building the Android APK (Windows)

From `frontend/`:

```powershell
npm run mobile:sync
cd android
.\gradlew.bat assembleDebug          # or assembleRelease for a signed build
```

Then copy the output to this folder:

```
android\app\build\outputs\apk\debug\app-debug.apk  ->  public\downloads\nexus-crm.apk
```

## iOS (.ipa)

Requires a Mac with Xcode (`npx cap add ios` → `npx cap open ios` → Archive →
export IPA). Drop the exported `.ipa` here. Note: iOS apps installed outside the
App Store / TestFlight need the device to trust the developer profile.
