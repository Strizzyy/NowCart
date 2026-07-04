# NowCart — APK Build Guide

Everything is already set up. Follow these steps to get the signed APK.

---

## What's Already Done (by Kiro)

- ✅ `vite-plugin-pwa` configured — builds `sw.js` + `manifest.webmanifest` on every `npm run build`
- ✅ PWA icons generated at `client/public/icons/icon-192.png` and `icon-512.png`
- ✅ `index.html` updated with PWA meta tags (theme color, apple-touch-icon, viewport-fit=cover)
- ✅ Install prompt component (`PwaInstallPrompt.tsx`) — shows "Add to Home Screen" banner automatically
- ✅ Capacitor installed + Android project scaffolded at `client/android/`
- ✅ `capacitor.config.ts` points to your live CloudFront URL — APK always loads fresh data

---

## Prerequisites (install these if not already installed)

1. **Android Studio** — https://developer.android.com/studio
   - During setup, install: Android SDK, Android SDK Platform 34, Android Build-Tools
2. **Java 17+** — comes bundled with Android Studio, or install separately
3. Set `ANDROID_HOME` environment variable:
   - Windows: `C:\Users\<you>\AppData\Local\Android\Sdk`
   - Add to PATH: `%ANDROID_HOME%\tools` and `%ANDROID_HOME%\platform-tools`

---

## Step 1 — Open in Android Studio

```bash
cd client
npx cap open android
```

This opens the `client/android/` folder in Android Studio. Wait for Gradle sync to finish (~2-3 min first time).

---

## Step 2 — Generate a Signing Key (one time only)

In Android Studio: **Build → Generate Signed Bundle / APK → APK → Create new keystore**

Or via command line:
```bash
keytool -genkey -v -keystore nowcart-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nowcart
```

Fill in the prompts. Save the `.jks` file somewhere safe — **don't commit it to git**.

---

## Step 3 — Configure Signing in Gradle

Edit `client/android/app/build.gradle`, add inside `android {}`:

```groovy
signingConfigs {
    release {
        storeFile file("path/to/nowcart-release-key.jks")
        storePassword "your_store_password"
        keyAlias "nowcart"
        keyPassword "your_key_password"
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

> **Tip:** Use environment variables instead of hardcoding passwords:
> `storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""`

---

## Step 4 — Build the APK

**Option A — Android Studio GUI:**
Build → Generate Signed Bundle / APK → APK → Release → Finish

**Option B — Command line:**
```bash
cd client/android
./gradlew assembleRelease
```

Output: `client/android/app/build/outputs/apk/release/app-release.apk`

---

## Step 5 — Host the APK on your EC2 / S3

### Via S3 (easiest):
```bash
aws s3 cp app-release.apk s3://nowcart-frontend/nowcart.apk --acl public-read
```
Download URL: `https://nowcart-frontend.s3.ap-southeast-2.amazonaws.com/nowcart.apk`

### Via EC2 directly:
Copy the APK to your EC2's nginx web root:
```bash
scp app-release.apk ubuntu@3.106.130.16:/var/www/html/nowcart.apk
```
Download URL: `http://3.106.130.16/nowcart.apk`

For HTTPS (needed for clean install), add a location block in nginx:
```nginx
location /nowcart.apk {
    alias /var/www/html/nowcart.apk;
    add_header Content-Disposition 'attachment; filename="NowCart.apk"';
    add_header Content-Type application/vnd.android.package-archive;
}
```

---

## Step 6 — Add Download Link to the App / README

Add this to your hackathon submission and demo page:

```
📱 Android APK: https://d2hj5yrm8sue4v.cloudfront.net/nowcart.apk
📱 PWA (any device): https://d2hj5yrm8sue4v.cloudfront.net
```

Judges on Android: tap the APK link → enable "Install from unknown sources" → install.
Judges on iPhone: open the PWA URL → tap Share → Add to Home Screen.

---

## Day-to-Day Workflow (after initial setup)

When you push new code to the live app, the APK automatically picks it up because
`capacitor.config.ts` uses `server.url` pointing to CloudFront — **no rebuild needed**.

To rebuild the APK after a native change (icons, permissions, etc.):
```bash
cd client
npm run build          # rebuild Vite + PWA assets
npx cap sync android   # copy assets into android/ project
# then rebuild APK in Android Studio
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ANDROID_HOME not set` | Set the env var and restart terminal |
| Gradle sync fails | File → Invalidate Caches and Restart in Android Studio |
| `cleartext traffic not permitted` | Already set `androidScheme: 'https'` in config — only HTTPS allowed |
| APK installs but shows blank screen | Make sure CloudFront URL is reachable; check CORS on your API |
| `cap sync` says no web assets | Run `npm run build` first |

---

## PWA — Already Live

Your deployed app at `https://d2hj5yrm8sue4v.cloudfront.net` is already a PWA after the next deploy.
Push the updated `dist/` to S3:

```bash
cd client
npm run build
aws s3 sync dist/ s3://nowcart-frontend --delete
aws cloudfront create-invalidation --distribution-id <YOUR_DIST_ID> --paths "/*"
```

Once deployed, Chrome on Android will show "Add NowCart to Home Screen" automatically.
