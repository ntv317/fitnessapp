import { Redirect } from 'expo-router';
import { PAYWALL_ENABLED } from '@/core/config/revenuecat';
import PaywallScreen from '@/features/premium/screens/PaywallScreen';

// While the paywall is disabled there is nothing to sell — the screen would
// render em-dash prices and a dead CTA. Send any deep link (trakfitness://paywall)
// back to the app so App Review never lands on a non-functional purchase screen.
export default function PaywallRoute() {
  if (!PAYWALL_ENABLED) return <Redirect href="/" />;
  return <PaywallScreen />;
}
