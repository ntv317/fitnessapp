import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Fonts } from '@/core/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICON_SIZE = 22;

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: Fonts.sansMedium,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="exercises"
        options={{
          title: t('tabs.exercises'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'body' : 'body-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: t('tabs.plans'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'calendar' : 'calendar-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.log'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'barbell' : 'barbell-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'person' : 'person-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
