import { ReactNode, useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandedLoading, LogoMark, PrimaryButton, RiderScreen } from "@/components/rider-ui";
import { RiderPermissionsGate } from "@/components/rider-permissions-gate";
import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { riderErrorMessage } from "@/lib/rider-api";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, pendingGoogleLink, session } = useRiderAuth();

  if (loading) {
    return (
      <RiderScreen>
        <BrandedLoading message="Conectando rider..." />
      </RiderScreen>
    );
  }

  if (!session || pendingGoogleLink) {
    return <AuthScreen forceGoogleLink={pendingGoogleLink} />;
  }

  return <RiderPermissionsGate>{children}</RiderPermissionsGate>;
}

function AuthScreen({ forceGoogleLink }: { forceGoogleLink: boolean }) {
  const auth = useRiderAuth();
  const [mode, setMode] = useState<"login" | "register" | "google-link">(forceGoogleLink ? "google-link" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const title = mode === "register" ? "Crear cuenta rider" : mode === "google-link" ? "Vincular Google" : "Entrar como rider";

  async function submit() {
    setError("");
    setPending(true);
    try {
      if (mode === "google-link") {
        await auth.linkPendingGoogleRider({ documentNumber, plateNumber });
        return;
      }

      if (mode === "register") {
        await auth.register({ email, password, documentNumber, plateNumber });
        return;
      }

      await auth.signIn({ email, password });
    } catch (submitError) {
      setError(riderErrorMessage(submitError));
    } finally {
      setPending(false);
    }
  }

  async function google() {
    setError("");
    setPending(true);
    try {
      await auth.signInWithGoogle();
    } catch (googleError) {
      const message = riderErrorMessage(googleError);
      setError(message);
      if (message.includes("Vincula")) setMode("google-link");
    } finally {
      setPending(false);
    }
  }

  return (
    <RiderScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.logoWrap}>
              <LogoMark />
              <Text style={styles.slogan}>Tu ruta, tus ganancias</Text>
              <Image source={RiderAssets.illustrations.riderMotorcycle} style={styles.heroImage} contentFit="contain" />
            </View>

            <View style={styles.panel}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {mode === "google-link"
                  ? "Confirma tus datos de rider aprobado para activar esta cuenta."
                  : "Usa la cuenta vinculada al rider aprobado en el SaaS."}
              </Text>

              {mode !== "google-link" ? (
                <>
                  <Field autoCapitalize="none" keyboardType="email-address" label="Correo" onChangeText={setEmail} value={email} />
                  <Field label="Contrasena" onChangeText={setPassword} secureTextEntry value={password} />
                </>
              ) : null}

              {mode !== "login" ? (
                <>
                  <Field autoCapitalize="characters" label="Carnet / documento" onChangeText={setDocumentNumber} value={documentNumber} />
                  <Field autoCapitalize="characters" label="Placa" onChangeText={setPlateNumber} value={plateNumber} />
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton onPress={submit} tone={mode === "google-link" ? "dark" : "lime"}>
                {pending ? (
                  <ActivityIndicator color={mode === "google-link" ? RiderColors.white : RiderColors.ink} />
                ) : (
                  <Text style={mode === "google-link" ? styles.buttonWhite : styles.buttonDark}>
                    {mode === "register" ? "Crear y entrar" : mode === "google-link" ? "Vincular rider" : "Entrar"}
                  </Text>
                )}
              </PrimaryButton>

              {mode !== "google-link" ? (
                <PrimaryButton onPress={google} tone="dark">
                  <Text style={styles.buttonWhite}>Continuar con Google</Text>
                </PrimaryButton>
              ) : null}

              {!forceGoogleLink ? (
                <View style={styles.modeRow}>
                  <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
                    <Text style={styles.modeLink}>{mode === "login" ? "Registrar rider aprobado" : "Ya tengo cuenta"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RiderScreen>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#9AA4B2"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  authContent: {
    minHeight: "100%",
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center",
    gap: 22,
  },
  logoWrap: {
    alignItems: "center",
    gap: 6,
  },
  slogan: {
    color: RiderColors.white,
    fontFamily: RiderFonts.bold,
    fontSize: 18,
    fontWeight: "700",
  },
  heroImage: {
    height: 150,
    marginTop: 4,
    width: "100%",
  },
  panel: {
    borderRadius: 28,
    backgroundColor: RiderColors.card,
    padding: 20,
    gap: 14,
  },
  title: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 25,
    fontWeight: "900",
  },
  subtitle: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  field: {
    gap: 7,
  },
  label: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: RiderColors.soft,
    color: RiderColors.ink,
    fontFamily: RiderFonts.extraBold,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 14,
  },
  error: {
    color: RiderColors.red,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  buttonDark: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  buttonWhite: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  modeRow: {
    alignItems: "center",
    paddingTop: 4,
  },
  modeLink: {
    color: RiderColors.blue900,
    fontFamily: RiderFonts.black,
    fontSize: 14,
    fontWeight: "900",
  },
});
