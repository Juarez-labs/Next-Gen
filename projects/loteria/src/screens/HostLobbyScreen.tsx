import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useGame } from "../contexts/GameContext";
import { useLocale } from "../contexts/LocaleContext";
import type { WinMode } from "../game/types";

export function HostLobbyScreen({ onCancel }: { onCancel: () => void }) {
  const { t } = useLocale();
  const { hostGame, game, players, startGame, leaveGame } = useGame();
  const [winMode, setWinMode] = useState<WinMode>("full");
  const [tempoMs, setTempoMs] = useState(5000);
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    setCreating(true);
    try {
      await hostGame({ winMode, tempoMs, falseClaimPenalty: true });
    } finally {
      setCreating(false);
    }
  };

  if (!game) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t("hostGame")}</Text>

        <Text style={styles.label}>{t("winMode")}</Text>
        <Segmented
          value={winMode}
          onChange={(v) => setWinMode(v as WinMode)}
          options={[
            { value: "corners", label: t("winCorners") },
            { value: "row", label: t("winRow") },
            { value: "full", label: t("winFull") },
          ]}
        />

        <Text style={styles.label}>{t("tempo")}</Text>
        <Segmented
          value={String(tempoMs)}
          onChange={(v) => setTempoMs(Number(v))}
          options={[
            { value: "7000", label: t("slow") },
            { value: "5000", label: t("medium") },
            { value: "3500", label: t("fast") },
          ]}
        />

        <Pressable style={[styles.btn, styles.primary]} onPress={onCreate} disabled={creating}>
          <Text style={styles.btnText}>{t("hostGame")}</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={onCancel}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{game.code}</Text>
      <View style={styles.qrWrap}>
        <QRCode value={`loteria://join/${game.code}`} size={220} />
      </View>
      <Text style={styles.subtle}>{players.length} jugador(es)</Text>
      {players.map((p) => (
        <Text key={p.userId} style={styles.player}>
          • {p.displayName}
        </Text>
      ))}

      <Pressable style={[styles.btn, styles.primary]} onPress={startGame}>
        <Text style={styles.btnText}>{t("start")}</Text>
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={leaveGame}>
        <Text style={styles.link}>Cancel game</Text>
      </Pressable>
    </ScrollView>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <View style={segStyles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[segStyles.opt, active && segStyles.active]}
          >
            <Text style={[segStyles.label, active && segStyles.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff8ef", flexGrow: 1 },
  title: { fontSize: 32, fontWeight: "800", color: "#7a1f1f", textAlign: "center", marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "700", color: "#7a1f1f", marginTop: 16, marginBottom: 8 },
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 24 },
  primary: { backgroundColor: "#c0392b" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkBtn: { padding: 12, alignItems: "center" },
  link: { color: "#7a1f1f", textDecorationLine: "underline" },
  qrWrap: { alignItems: "center", padding: 16, backgroundColor: "#fff", borderRadius: 16, marginVertical: 16 },
  subtle: { textAlign: "center", color: "#7a6a52", marginBottom: 8 },
  player: { fontSize: 16, color: "#3a2a1a", paddingVertical: 2 },
});

const segStyles = StyleSheet.create({
  row: { flexDirection: "row", backgroundColor: "#fde6c8", borderRadius: 10, padding: 4 },
  opt: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  active: { backgroundColor: "#c0392b" },
  label: { color: "#7a1f1f", fontWeight: "600", fontSize: 12 },
  activeLabel: { color: "#fff" },
});
