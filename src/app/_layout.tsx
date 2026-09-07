import { useFonts } from 'expo-font';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold';
import { Poppins_900Black } from '@expo-google-fonts/poppins/900Black';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import AppTabs from '@/components/app-tabs';
import { RiderNotifications } from '@/components/rider-notifications';
import { RiderAuthProvider } from '@/context/rider-auth';
import { RiderDashboardProvider } from '@/context/rider-dashboard';
import '@/lib/background-location';

void SplashScreen.preventAutoHideAsync().catch(() => null);

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => null);
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={DefaultTheme}>
      <RiderAuthProvider>
        <RiderNotifications>
          <RiderDashboardProvider>
            <StatusBar style="dark" />
            <AppTabs />
          </RiderDashboardProvider>
        </RiderNotifications>
      </RiderAuthProvider>
    </ThemeProvider>
  );
}
