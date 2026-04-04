# Deep Link Verification

Having a server live at `https://polled.app` is necessary, but it is not sufficient for iOS Universal Links and Android App Links.

## iOS

Your server must return a valid `apple-app-site-association` file at:

- `https://polled.app/.well-known/apple-app-site-association`

This repo already includes the template file in `public/.well-known/apple-app-site-association`, but it still contains a placeholder:

- `YOUR_APPLE_TEAM_ID`

You need to replace that with your real Apple Team ID so the `appID` becomes:

- `YOUR_REAL_TEAM_ID.com.kdcao.polled`

## Android

Your server must return a valid `assetlinks.json` file at:

- `https://polled.app/.well-known/assetlinks.json`

This repo already includes the template file in `public/.well-known/assetlinks.json`, but it still contains a placeholder:

- `YOUR_RELEASE_SHA256_FINGERPRINT`

You need to replace that with the SHA-256 fingerprint for the certificate that signs your Android app.

If you ship through Google Play, you usually want the Play app-signing SHA-256. If you install direct EAS builds too, you may also need the EAS/upload key fingerprint depending on your testing flow.

## Server Requirements

Your domain setup should:

- serve both files over HTTPS
- serve them without redirects
- serve the exact file contents
- keep them publicly reachable

If `polled.app` is currently just pointing at a dev server, that is only enough if that server is actually serving these two files correctly at the exact `.well-known` URLs.
