import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import '@/core/theme/applyGlobalFont'; // default font shim — must run before any Text renders
import { AppProviders } from '@/core/providers/AppProviders';
import { useAutoBackup } from '@/features/backup/hooks/useBackups';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AutoBackup() {
  useAutoBackup();
  return null;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <SafeAreaProvider>
        <AutoBackup />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </AppProviders>
  );
}
