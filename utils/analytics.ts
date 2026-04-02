import { Platform } from 'react-native';
import { app } from '@/config/firebaseConfig';

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;
type GtagFunction = (...args: any[]) => void;

let analyticsPromise: Promise<any | null> | null = null;
let debugModeConfigured = false;

const isDebugAnalyticsEnabled = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  try {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      window.localStorage.getItem('polled_analytics_debug') === '1'
    );
  } catch {
    return false;
  }
};

const sanitizeParams = (params: AnalyticsParams = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );

const enableDebugModeIfNeeded = () => {
  if (!isDebugAnalyticsEnabled() || debugModeConfigured || typeof window === 'undefined') {
    return;
  }

  const measurementId = app.options.measurementId;
  const gtag = (window as Window & { gtag?: GtagFunction }).gtag;

  if (!measurementId || typeof gtag !== 'function') {
    return;
  }

  // Configure GA's actual debug mode on the web runtime, not just a custom event param.
  gtag('set', 'debug_mode', true);
  gtag('config', measurementId, { debug_mode: true });
  debugModeConfigured = true;
};

const getAnalyticsInstance = async () => {
  if (Platform.OS !== 'web') return null;

  if (!analyticsPromise) {
    analyticsPromise = import('firebase/analytics')
      .then(async ({ getAnalytics, isSupported }) => {
        const supported = await isSupported();
        if (!supported) return null;

        const analytics = getAnalytics(app);
        enableDebugModeIfNeeded();
        return analytics;
      })
      .catch((error) => {
        console.error('Analytics unavailable:', error);
        return null;
      });
  }

  return analyticsPromise;
};

export const trackEvent = async (eventName: string, params: AnalyticsParams = {}) => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;

    const { logEvent } = await import('firebase/analytics');
    const finalParams = sanitizeParams(params);

    if (isDebugAnalyticsEnabled()) {
      console.info('[analytics]', eventName, finalParams);
    }

    await logEvent(analytics, eventName, finalParams);
  } catch (error) {
    console.error(`Analytics event failed: ${eventName}`, error);
  }
};

export const trackScreenView = async (screenName: string, screenClass = 'expo_router_screen') => {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;

    const { logEvent } = await import('firebase/analytics');
    const finalParams = {
      firebase_screen: screenName,
      firebase_screen_class: screenClass,
    };

    if (isDebugAnalyticsEnabled()) {
      console.info('[analytics]', 'screen_view', finalParams);
    }

    await logEvent(analytics, 'screen_view', finalParams);
  } catch (error) {
    console.error(`Analytics screen view failed: ${screenName}`, error);
  }
};
