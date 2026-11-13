# DOGE AI on Chromebook

DOGE AI is distributed to Chromebooks as an installable Progressive Web App (PWA). ChromeOS does not run Windows `.exe` installers, so the supported install path is Chrome's **Install app** feature.

## Install

1. Open the deployed DOGE AI site in Chrome on the Chromebook.
2. Use DOGE AI normally.
3. Select **Install app** in the DOGE AI install prompt, or use the install icon in Chrome's address bar.
4. If Chrome does not show the prompt, open the Chrome menu and choose **Install page as app** (menu wording may vary).
5. Launch DOGE AI from the Chromebook Launcher.

## Browser / WebView fallback

If Chrome does not offer installation, open the same deployed site in Chrome and use it as a normal web app. The app is responsive and does not require native Chromebook APIs. A compatible Android WebView host can also load the deployed site, but Chrome's PWA install is the recommended route.

## Offline behavior

The service worker caches the app shell and static assets after they are loaded. The chat API, AI responses, accounts, groups, and other server-backed features still require an internet connection.

## Build artifact

The `Chromebook PWA build` GitHub Actions workflow builds `dist/` and uploads it as `DOGE-AI-Chromebook-PWA`. This is a web-app bundle for hosting, not a ChromeOS `.exe` or `.deb` installer. For normal users, install from the deployed HTTPS website.
