import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useGame } from "../contexts/GameContext";
import { useLocale } from "../contexts/LocaleContext";

export function JoinScreen({ onCancel }: { onCancel: () => void }) {
  const { t } = useLocale();
  const { joinGame } = useGame();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  const submit = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    try {
      await joinGame(c);
    } catch (e: any) {
      Alert.alert("Couldn't join", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const onScanned = (raw: string) => {
    setScanning(false);
    // QR payload is `loteria://join/CODE`
    const match = raw.match(/join\/([A-Z0-9]+)/i);
    if (match) void submit(match[1]);
    else void submit(raw);
  };

  if (scanning) {
    if (!permission?.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{t("scanQR")}</Text>
          <Pressable style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant camera</Text>
          </Pressable>
          <Pressable onPress={() => setScanning(false)}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <CameraView
          style={styles.scanner}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(e) => onScanned(e.data)}
        />
        <Pressable style={styles.linkBtn} onPress={() => setScanning(false)}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("joinGame")}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={t("enterCode")}
        style={styles.input}
        autoCapitalize="characters"
        maxLength={6}
      />
      <Pressable
        style={[styles.btn, styles.primary]}
        onPress={() => submit(code)}
        disabled={busy}
      >
        <Text style={styles.btnText}>{t("joinGame")}</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.secondary]} onPress={() => setScanning(true)}>
        <Text style={[styles.btnText, { color: "#7a1f1f" }]}>{t("scanQR")}</Text>
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={onCancel}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff8ef", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", color: "#7a1f1f", textAlign: "center", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 12,
    padding: 18,
    fontSize: 26,
    textAlign: "center",
    letterSpacing: 6,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  primary: { backgroundColor: "#c0392b" },
  secondary: { backgroundColor: "#fde6c8" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkBtn: { padding: 12, alignItems: "center" },
  link: { color: "#7a1f1f", textDecorationLine: "underline" },
  scanner: { flex: 1 },
});
