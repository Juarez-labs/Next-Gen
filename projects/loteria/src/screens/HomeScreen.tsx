import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";

export function HomeScreen({
  onHost,
  onJoin,
  onCustomize,
}: {
  onHost: () => void;
  onJoin: () => void;
  onCustomize: () => void;
}) {
  const { t, locale, setLocale } = useLocale();
  const { signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("appName")}</Text>

      <Pressable style={[styles.btn, styles.primary]} onPress={onHost}>
        <Text style={styles.btnText}>{t("hostGame")}</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.secondary]} onPress={onJoin}>
        <Text style={[styles.btnText, { color: "#7a1f1f" }]}>{t("joinGame")}</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.ghost]} onPress={onCustomize}>
        <Text style={[styles.btnText, { color: "#7a1f1f" }]}>{t("customize")}</Text>
      </Pressable>

      <View style={styles.footer}>
        <Pressable onPress={() => setLocale(locale === "es" ? "en" : "es")}>
          <Text style={styles.link}>
            {t("language")}: {locale === "es" ? t("spanish") : t("english")}
          </Text>
        </Pressable>
        <Pressable onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff8ef" },
  title: { fontSize: 36, fontWeight: "800", textAlign: "center", marginBottom: 32, color: "#7a1f1f" },
  btn: { paddingVertical: 18, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  primary: { backgroundColor: "#c0392b" },
  secondary: { backgroundColor: "#fde6c8" },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#7a1f1f" },
  btnText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  footer: { marginTop: 40, alignItems: "center", gap: 12 },
  link: { color: "#7a1f1f", textDecorationLine: "underline" },
});
