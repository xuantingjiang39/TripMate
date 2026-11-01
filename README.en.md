<img src="docs/media/tripmate-icon.png" alt="TripMate journey icon" width="88" height="88">

# TripMate

**Plan a family trip with less guesswork: daily activities, transport, rest breaks and a shareable itinerary.**

[中文](README.md) · English

[Try the web app](https://111.230.133.155/) · [Windows installer](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-Setup.exe) · [Android APK](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v52-android-v1.1.4.apk) · [All downloads](https://github.com/xuantingjiang39/TripMate/releases/tag/v54)

TripMate is a Chinese-first travel-planning project focused on family trips, including trips with older parents. Describe the destination, duration, budget and travel needs, then review and edit the daily itinerary before sharing it with your family.

## What it offers

- AI-generated itinerary drafts through a configured DeepSeek backend.
- Editable day-by-day plans, transport information and cost breakdowns.
- PDF itinerary export on Windows / web.
- Account-based plans and Android local snapshot protection.
- Place and hotel information from configured AMap and Meituan integrations, with source links when available.
- Map and location-based travel assistance, subject to device permissions and provider coverage.

![Example workspace and itinerary](docs/media/interface-preview.gif)

This slideshow shows the real desktop UI with example data. It is not a recording of live AI generation, payment or GPS navigation; no real account or private itinerary is shown.

## Current status

**Beta.** Downloads are free; AI generation uses the backend's configured model and credit policy. Guest preview is limited to one trial and the first day. Full itineraries require an account. The app interface is primarily Chinese.

Windows 1.0.1 / v54 is an Electron client for the online workspace and requires a network connection. Android 1.1.4 / v52 uses React Native / Expo. The current Node.js server and web source are in `guest-v55/`, adding a public [download page](https://111.230.133.155/download) for both installers. The owner has manually deployed v55; the live health endpoint and download page have been verified. There is no published iOS installer.

Desktop startup, PDF export, reconnection and Android sync-protection scenarios have been checked. Some checks use mocked services. Real payments, hotel availability, GPS accuracy and broad device compatibility have not been comprehensively verified. The Windows installer is not commercially code-signed.

## Help shape the project

Feedback on installation, itinerary readability and family-friendly pacing is especially useful.

- [Report a problem](https://github.com/xuantingjiang39/TripMate/issues/new/choose)
- [Join discussions](https://github.com/xuantingjiang39/TripMate/discussions)
- [Contribute a fix or improve documentation](CONTRIBUTING.md)

If TripMate is useful to you, a Star helps you follow future updates.

## Run from source

```sh
git clone https://github.com/xuantingjiang39/TripMate.git
cd TripMate/TripMate-desktop-v54
npm ci
node node_modules/electron/install.js
npm test
npm start
```

The desktop client points to the existing HTTPS service. Backend keys, user databases, cookies, dependencies and local test data are not in this repository. See the component READMEs for server configuration and mobile development.

Source is publicly available; a project-wide license has not been selected. Third-party components retain their respective licenses.
