import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Background-resilient rest timer.
 *
 * Strategy:
 *  1. While foregrounded: a 1-second JS interval ticks down `seconds`.
 *  2. On background: we record the wall-clock time AND schedule a local
 *     notification to fire when the rest period would end — so the user
 *     gets an alert even if the OS kills the JS thread.
 *  3. On resume: we compute the real elapsed time from the wall clock,
 *     cancel the pending notification (already handled), and reconcile.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NOTIF_ID_KEY = '__rest_timer_notif__';

// Permission is requested at the first timer start (contextual — the user just
// did the thing notifications are for), not at app launch.
let requestedPermission = false;

export function useRestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  const notifIdRef = useRef<string | null>(null);

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cancelNotif = async () => {
    if (notifIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
      notifIdRef.current = null;
    }
  };

  const scheduleNotif = async (remainingSeconds: number) => {
    await cancelNotif();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Complete 💪',
        body: 'Time for your next set!',
        sound: true,
      },
      trigger: { seconds: remainingSeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
    });
    notifIdRef.current = id;
  };

  const tick = useCallback(() => {
    setSeconds((prev) => {
      if (prev <= 1) {
        clearTick();
        setIsRunning(false);
        return 0;
      }
      return prev - 1;
    });
  }, []);

  const start = useCallback(
    (duration: number) => {
      if (!requestedPermission) {
        requestedPermission = true;
        Notifications.requestPermissionsAsync().catch(() => {});
      }
      clearTick();
      cancelNotif();
      setSeconds(duration);
      setIsRunning(true);
      intervalRef.current = setInterval(tick, 1000);
    },
    [tick],
  );

  const pause = useCallback(() => {
    clearTick();
    cancelNotif();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    clearTick();
    cancelNotif();
    setSeconds(0);
    setIsRunning(false);
  }, []);

  // Background resilience
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if ((next === 'background' || next === 'inactive') && isRunning) {
        backgroundedAtRef.current = Date.now();
        // Snapshot current seconds from state via closure isn't reliable;
        // we use a ref to capture it at the moment of backgrounding.
        // The reconcile on resume uses the wall clock difference instead.
        setSeconds((cur) => {
          scheduleNotif(cur);
          return cur;
        });
        clearTick();
      } else if (next === 'active' && backgroundedAtRef.current !== null) {
        const elapsed = Math.floor((Date.now() - backgroundedAtRef.current) / 1000);
        backgroundedAtRef.current = null;
        await cancelNotif();

        if (isRunning) {
          setSeconds((prev) => {
            const remaining = prev - elapsed;
            if (remaining <= 0) {
              setIsRunning(false);
              return 0;
            }
            // Resume ticking
            intervalRef.current = setInterval(tick, 1000);
            return remaining;
          });
        }
      }
    });
    return () => sub.remove();
  }, [isRunning, tick]);

  useEffect(() => () => { clearTick(); cancelNotif(); }, []);

  return { seconds, isRunning, start, pause, reset };
}
