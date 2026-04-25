# Polled
**Stop scrolling. Start voting.**

Polled is a real-time event coordination app built with **Expo**, **React Native**, and **Firebase**. It solves the "endless group chat debate" by allowing users to create events and host polls for things like location, time, and activities.

https://polled.app
Admin dashboard: https://admin.polled.app

Production analytics ingest is built with:
`EXPO_PUBLIC_ANALYTICS_INGEST_URL=https://analytics.polled.app/analytics`

Route `https://analytics.polled.app/analytics` to the `polled-notification-worker`
container on port `8787`. The worker does not need a public Docker port when the
reverse proxy is on the same Docker network.
---

## Key Features
* **Loginless Onboarding:** Jump straight into creating or joining events using Firebase Anonymous Authentication.
* **Account Upgrading:** Seamlessly link your temporary guest account to a permanent **Google** or **Email** account without losing any data.
* **Real-time Dashboards:** Track active events, view "Join Codes," and see high-level poll summaries at a glance.
* **Universal Design:** A sleek, Zinc-themed dark mode UI powered by **Gluestack UI** and **Tailwind CSS (NativeWind)**, optimized for iOS, Android, and Web.
* **Secure Settings:** Dedicated profile management to update display names via custom modals and manage account security.

---

## Tech Stack
* **Framework:** [Expo](https://expo.dev/) (SDK 54)
* **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) (File-based)
* **UI Library:** [Gluestack UI](https://gluestack.io/) & [Lucide Icons](https://lucide.dev/)
* **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
* **Backend:** [Firebase](https://firebase.google.com/)
    * **Auth:** Anonymous, Email/Password, and Google Sign-In.
    * **Firestore:** Real-time NoSQL database for events and user profiles.

---

## TODO
* test notifications
