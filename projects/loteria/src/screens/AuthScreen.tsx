import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "../lib/supabase";
import { useLocale } from "../contexts/LocaleContext";

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen() {
  const { t } = useLocale();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const onEmailSubmit = async () => {
    setBusy(true);
    const res =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName || "Jugador" } },
          });
    setBusy(false);
    if (res.error) Alert.alert(res.error.message);
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      // Uses the OAuth provider configured in your Supabase project.
      // The redirect goes through expo-auth-session's proxy, which works for
      // local Expo Go development; production builds should use a custom scheme.
      const redirectTo = AuthSession.makeRedirectUri({ scheme: "loteria" });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error ?? new Error("no url");
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const access_token = url.hash.match(/access_token=([^&]+)/)?.[1];
        const refresh_token = url.hash.match(/refresh_token=([^&]+)/)?.[1];
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token from Apple");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple sign-in failed", e.message ?? String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("appName")}</Text>

      <Pressable style={[styles.btn, styles.google]} onPress={onGoogle} disabled={busy}>
        <Text style={styles.btnText}>{t("continueWithGoogle")}</Text>
      </Pressable>

      {Platform.OS === "ios" && (
        <Pressable style={[styles.btn, styles.apple]} onPress={onApple} disabled={busy}>
          <Text style={[styles.btnText, { color: "#fff" }]}>{t("continueWithApple")}</Text>
        </Pressable>
      )}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      {mode === "signUp" && (
        <TextInput
          placeholder={t("displayName")}
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
          autoCapitalize="words"
        />
      )}
      <TextInput
        placeholder={t("email")}
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        placeholder={t("password")}
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      <Pressable style={[styles.btn, styles.primary]} onPress={onEmailSubmit} disabled={busy}>
        <Text style={[styles.btnText, { color: "#fff" }]}>
          {mode === "signIn" ? t("signIn") : t("signUp")}
        </Text>
      </Pressable>

      <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
        <Text style={styles.switch}>
          {mode === "signIn" ? t("signUp") : t("signIn")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff8ef" },
  title: { fontSize: 32, fontWeight: "800", textAlign: "center", marginBottom: 32, color: "#7a1f1f" },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  google: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dadce0" },
  apple: { backgroundColor: "#000" },
  primary: { backgroundColor: "#c0392b" },
  btnText: { fontSize: 16, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e0d8c8" },
  dividerText: { paddingHorizontal: 12, color: "#7a6a52" },
  input: {
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  switch: { textAlign: "center", color: "#7a1f1f", marginTop: 8, fontWeight: "600" },
});
