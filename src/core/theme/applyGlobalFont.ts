import React from 'react';
import { Text, TextInput } from 'react-native';
import { Fonts } from './index';

/**
 * Inject a default font family into every <Text>/<TextInput> so the whole app
 * renders in Hanken Grotesk without touching each call site. Explicit styles on
 * individual components still win (they're appended after the base).
 *
 * Note: expo-google-fonts registers each weight as a separate family, so screens
 * that need true bold should use <AppText variant="..."> / explicit Fonts.*.
 * This shim guarantees no element falls back to the platform system font.
 */
function patch(Component: any) {
  const orig = Component.render;
  if (typeof orig !== 'function' || Component.__fontPatched) return;
  Component.render = function (...args: any[]) {
    const el = orig.apply(this, args);
    return React.cloneElement(el, {
      style: [{ fontFamily: Fonts.sans }, el.props.style],
    });
  };
  Component.__fontPatched = true;
}

patch(Text);
patch(TextInput);
