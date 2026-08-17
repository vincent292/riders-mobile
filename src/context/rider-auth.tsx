import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import {
  fetchRiderMe,
  linkGoogleRider,
  loginRider,
  registerRider,
  RiderApiError,
  type MobileRider,
  type RiderSessionPayload,
} from "@/lib/rider-api";
import { config } from "@/lib/config";
import { getSupabaseClient } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const sessionStorageKey = "riders-mobile-session-v1";

type RiderAuthSession = {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
  };
  riders: MobileRider[];
  activeRiders: MobileRider[];
};

type RiderAuthContextValue = {
  session: RiderAuthSession | null;
  loading: boolean;
  pendingGoogleLink: boolean;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; documentNumber: string; plateNumber: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  linkPendingGoogleRider: (input: { documentNumber: string; plateNumber: string }) => Promise<void>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const RiderAuthContext = createContext<RiderAuthContextValue | null>(null);

function normalizeSession(payload: RiderSessionPayload): RiderAuthSession {
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
    riders: payload.riders,
    activeRiders: payload.activeRiders ?? payload.riders.filter((rider) => rider.status === "active"),
  };
}

async function persistSession(session: RiderAuthSession | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(sessionStorageKey);
    return;
  }

  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(session));
}

async function refreshSupabaseTokens(session: RiderAuthSession) {
  if (!session.refreshToken) return session;

  const supabase = getSupabaseClient();
  if (!supabase) return session;

  const { data, error } = await supabase.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  if (error || !data.session) return session;

  return {
    ...session,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token ?? session.refreshToken,
    user: {
      id: data.session.user.id,
      email: data.session.user.email ?? session.user.email,
    },
  };
}

async function fetchMeWithRefresh(session: RiderAuthSession) {
  const refreshed = await refreshSupabaseTokens(session);

  try {
    const me = await fetchRiderMe(refreshed.accessToken);
    return { me, session: refreshed };
  } catch (error) {
    if (!(error instanceof RiderApiError) || error.code !== "unauthorized") {
      throw error;
    }

    const retrySession = await refreshSupabaseTokens(refreshed);
    if (retrySession.accessToken === refreshed.accessToken) {
      throw error;
    }

    const me = await fetchRiderMe(retrySession.accessToken);
    return { me, session: retrySession };
  }
}

function parseStoredSession(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as RiderAuthSession;
    if (!parsed.accessToken || !parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function RiderAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RiderAuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingGoogleToken, setPendingGoogleToken] = useState("");

  const saveSession = useCallback(async (nextSession: RiderAuthSession | null) => {
    let sessionToSave = nextSession;

    if (nextSession?.refreshToken) {
      sessionToSave = await refreshSupabaseTokens(nextSession).catch(() => nextSession);
    }

    setSession(sessionToSave);
    await persistSession(sessionToSave);
  }, []);

  const refreshSession = useCallback(async () => {
    const current = session;
    if (!current) return;

    const { me, session: refreshed } = await fetchMeWithRefresh(current);
    await saveSession({
      ...refreshed,
      user: me.user,
      riders: me.riders,
      activeRiders: me.activeRiders,
    });
  }, [saveSession, session]);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const stored = parseStoredSession(await SecureStore.getItemAsync(sessionStorageKey));
      if (!mounted) return;

      if (!stored) {
        setLoading(false);
        return;
      }

      setSession(stored);
      try {
        const { me, session: refreshed } = await fetchMeWithRefresh(stored);
        if (!mounted) return;
        await saveSession({
          ...refreshed,
          user: me.user,
          riders: me.riders,
          activeRiders: me.activeRiders,
        });
      } catch {
        if (mounted) await saveSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void restore();

    return () => {
      mounted = false;
    };
  }, [saveSession]);

  useEffect(() => {
    if (!session?.refreshToken) return;

    const interval = setInterval(() => {
      void refreshSession().catch(() => null);
    }, 8 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshSession, session?.refreshToken]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const payload = await loginRider(input);
      setPendingGoogleToken("");
      await saveSession(normalizeSession(payload));
    },
    [saveSession],
  );

  const register = useCallback(
    async (input: { email: string; password: string; documentNumber: string; plateNumber: string }) => {
      const payload = await registerRider(input);
      setPendingGoogleToken("");
      await saveSession(normalizeSession(payload));
    },
    [saveSession],
  );

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new RiderApiError("google-not-configured");

    const redirectTo =
      config.authRedirectUri ||
      AuthSession.makeRedirectUri({
        path: "auth/callback",
        scheme: "ridersmobile",
      });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      throw new RiderApiError("google-auth-failed");
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      throw new RiderApiError("google-cancelled");
    }

    const parsedUrl = new URL(result.url);
    const code = parsedUrl.searchParams.get("code");
    if (!code) {
      throw new RiderApiError("google-auth-failed");
    }

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !sessionData.session || !sessionData.user) {
      throw new RiderApiError("google-auth-failed");
    }

    try {
      const me = await fetchRiderMe(sessionData.session.access_token);
      setPendingGoogleToken("");
      await saveSession({
        accessToken: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
        user: me.user,
        riders: me.riders,
        activeRiders: me.activeRiders,
      });
    } catch (error) {
      if (error instanceof RiderApiError && error.code === "rider-account-not-linked") {
        setPendingGoogleToken(sessionData.session.access_token);
        throw new RiderApiError("google-rider-link-required");
      }
      throw error;
    }
  }, [saveSession]);

  const linkPendingGoogleRider = useCallback(
    async (input: { documentNumber: string; plateNumber: string }) => {
      if (!pendingGoogleToken) throw new RiderApiError("google-rider-link-required");
      const payload = await linkGoogleRider(pendingGoogleToken, input);
      const activeRiders = payload.riders.filter((rider) => rider.status === "active");
      await saveSession({
        accessToken: pendingGoogleToken,
        user: payload.user,
        riders: payload.riders,
        activeRiders,
      });
      setPendingGoogleToken("");
    },
    [pendingGoogleToken, saveSession],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase?.auth.signOut().catch(() => null);
    setPendingGoogleToken("");
    await saveSession(null);
  }, [saveSession]);

  const value = useMemo<RiderAuthContextValue>(
    () => ({
      session,
      loading,
      pendingGoogleLink: Boolean(pendingGoogleToken),
      signIn,
      register,
      signInWithGoogle,
      linkPendingGoogleRider,
      refreshSession,
      signOut,
    }),
    [linkPendingGoogleRider, loading, pendingGoogleToken, refreshSession, register, session, signIn, signInWithGoogle, signOut],
  );

  return <RiderAuthContext.Provider value={value}>{children}</RiderAuthContext.Provider>;
}

export function useRiderAuth() {
  const context = useContext(RiderAuthContext);
  if (!context) {
    throw new Error("useRiderAuth debe usarse dentro de RiderAuthProvider");
  }

  return context;
}
