import { ReactNode, useRef, useState } from "react";
import { Image } from "expo-image";
import { AtSign, BadgeCheck, Bike, Eye, EyeOff, LockKeyhole, LogIn, UserRound, type LucideIcon } from "lucide-react-native";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandedLoading, LogoMark, PrimaryButton, RiderScreen } from "@/components/rider-ui";
import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { RiderApiError, riderErrorMessage } from "@/lib/rider-api";
import { validateRiderForm } from "@/lib/rider-domain";

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

  return <>{children}</>;
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
  const busy = useRef(false);

  const title = mode === "register" ? "Crear cuenta rider" : mode === "google-link" ? "Vincular Google" : "Entrar como rider";

  async function submit() {
    if (busy.current) return;
    const input = { email: email.trim().toLowerCase(), password, documentNumber: documentNumber.trim(), plateNumber: plateNumber.trim().toUpperCase() };
    const validation = validateRiderForm(input, mode);
    if (validation) { setError(validation); return; }
    busy.current = true;
    setError("");
    setPending(true);
    try {
      if (mode === "google-link") {
        await auth.linkPendingGoogleRider(input);
        return;
      }

      if (mode === "register") {
        await auth.register(input);
        return;
      }

      await auth.signIn(input);
    } catch (submitError) {
      setError(riderErrorMessage(submitError));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function google() {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setPending(true);
    try {
      await auth.signInWithGoogle();
    } catch (googleError) {
      const message = riderErrorMessage(googleError);
      setError(message);
      if (googleError instanceof RiderApiError && googleError.code === "google-rider-link-required") setMode("google-link");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <RiderScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.heroPanel}>
              <Image source={RiderAssets.reference.bannerLight} style={styles.heroBanner} contentFit="contain" />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View style={styles.titleRow}>
                  <LogoMark compact tone="dark" />
                  <Text style={styles.title}>{title}</Text>
                </View>
                <Text style={styles.subtitle}>
                  {mode === "google-link"
                    ? "Confirma tus datos de rider aprobado para activar esta cuenta."
                    : mode === "register" ? "Tu restaurante debe tener tu correo, documento y placa aprobados." : "Bienvenido de vuelta. Tu próximo recorrido empieza aquí."}
                </Text>
              </View>

              {mode !== "google-link" ? (
                <>
                  <Field autoCapitalize="none" icon={AtSign} keyboardType="email-address" label="Correo" onChangeText={setEmail} value={email} />
                  <Field autoCapitalize="none" icon={LockKeyhole} label="Contraseña" onChangeText={setPassword} secureTextEntry value={password} />
                </>
              ) : null}

              {mode !== "login" ? (
                <>
                  <Field autoCapitalize="characters" icon={BadgeCheck} label="Carnet / documento" onChangeText={setDocumentNumber} value={documentNumber} />
                  <Field autoCapitalize="characters" icon={Bike} label="Placa" onChangeText={setPlateNumber} value={plateNumber} />
                </>
              ) : null}

              {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

              <PrimaryButton disabled={pending} onPress={submit} tone={mode === "google-link" ? "dark" : "lime"}>
                {pending ? (
                  <ActivityIndicator color={mode === "google-link" ? RiderColors.white : RiderColors.ink} />
                ) : (
                  <View style={styles.buttonContent}>
                    <LogIn color={mode === "google-link" ? RiderColors.white : RiderColors.ink} size={18} strokeWidth={2.8} />
                    <Text style={mode === "google-link" ? styles.buttonWhite : styles.buttonDark}>
                      {mode === "register" ? "Crear y entrar" : mode === "google-link" ? "Vincular rider" : "Entrar"}
                    </Text>
                  </View>
                )}
              </PrimaryButton>

              {mode !== "google-link" ? (
                <PrimaryButton disabled={pending} onPress={google} tone="dark">
                  <View style={styles.buttonContent}>
                    <UserRound color={RiderColors.white} size={18} strokeWidth={2.6} />
                    <Text style={styles.buttonWhite}>Continuar con Google</Text>
                  </View>
                </PrimaryButton>
              ) : null}

              {!forceGoogleLink ? (
                <View style={styles.modeRow}>
                  <Pressable accessibilityRole="button" disabled={pending} style={{ minHeight: 48, justifyContent: "center" }} onPress={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>
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
  icon: Icon,
  label,
  ...props
}: {
  icon: LucideIcon;
  label: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(props.secureTextEntry);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Icon color={RiderColors.blue900} size={19} strokeWidth={2.3} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          autoCorrect={false}
          secureTextEntry={isPassword && !passwordVisible}
          placeholderTextColor="#9AA4B2"
          style={styles.input}
        />
        {isPassword ? (
          <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} hitSlop={10} onPress={() => setPasswordVisible((visible) => !visible)}>
            {passwordVisible ? (
              <EyeOff color={RiderColors.muted} size={20} strokeWidth={2.2} />
            ) : (
              <Eye color={RiderColors.muted} size={20} strokeWidth={2.2} />
            )}
          </Pressable>
        ) : null}
      </View>
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
    gap: 14,
    justifyContent: "center",
    minHeight: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
  },
  heroPanel: {
    height: 148,
    overflow: "hidden",
    alignSelf: "center",
    width: "100%",
  },
  heroBanner: {
    height: "100%",
    width: "100%",
  },
  panel: {
    backgroundColor: "transparent",
    gap: 14,
    padding: 18,
    alignSelf: "center",
    width: "100%",
  },
  panelHeader: {
    gap: 5,
    paddingBottom: 2,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  title: {
    color: RiderColors.ink,
    flex: 1,
    fontFamily: RiderFonts.black,
    fontSize: 21,
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
    color: RiderColors.ink,
    flex: 1,
    fontFamily: RiderFonts.extraBold,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 50,
    paddingVertical: 0,
  },
  inputShell: {
    alignItems: "center",
    backgroundColor: RiderColors.soft,
    borderColor: RiderColors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
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
  buttonContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
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
