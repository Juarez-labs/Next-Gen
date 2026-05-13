import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalledCardsBanner } from "../components/CalledCardsBanner";
import { TablaGrid } from "../components/TablaGrid";
import { useGame } from "../contexts/GameContext";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { CARDS } from "../data/cards";
import { ttsVerse } from "../lib/openai";

export function GameScreen({ onLeave }: { onLeave: () => void }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { game, players, me, calledIndices, toggleMark, claimWin, pauseTimer, resumeTimer, leaveGame } =
    useGame();
  const [paused, setPaused] = useState(false);
  const lastSpokenRef = useRef<number>(-1);

  // Speak each new card as it's called: try OpenAI TTS, fall back to native Speech.
  useEffect(() => {
    const current = calledIndices.at(-1);
    if (current == null) return;
    if (calledIndices.length - 1 === lastSpokenRef.current) return;
    lastSpokenRef.current = calledIndices.length - 1;
    const card = CARDS[current];
    const text = `${card.verse} ¡${card.name}!`;

    (async () => {
      const audio = await ttsVerse({ text });
      if (audio?.audioBase64) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: `data:audio/mp3;base64,${audio.audioBase64}` },
            { shouldPlay: true }
          );
          sound.setOnPlaybackStatusUpdate((s) => {
            if ("didJustFinish" in s && s.didJustFinish) void sound.unloadAsync();
          });
          return;
        } catch {
          // fall through to native Speech
        }
      }
      Speech.speak(text, { language: "es-MX", rate: 0.95 });
    })();
  }, [calledIndices.length]);

  const onClaim = async () => {
    const { won } = await claimWin();
    if (!won) {
      Alert.alert(t("falseClaim"), game?.falseClaimPenalty ? t("outForRound") : "");
    }
  };

  const togglePause = () => {
    if (paused) {
      resumeTimer();
    } else {
      pauseTimer();
    }
    setPaused(!paused);
  };

  if (!game || !me) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (game.status === "finished") {
    const winner = players.find((p) => p.userId === game.winnerId);
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: "#7a1f1f" }]}>
        <Text style={styles.winTitle}>{t("winner")}</Text>
        <Text style={styles.winName}>{winner?.displayName ?? "?"}</Text>
        <Pressable style={[styles.btn, styles.primary]} onPress={async () => { await leaveGame(); onLeave(); }}>
          <Text style={styles.btnText}>OK</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isHost = game.hostId === user?.id;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <CalledCardsBanner calledIndices={calledIndices} />

      <View style={styles.body}>
        <TablaGrid tabla={me.tabla} marks={me.marks} onTogglePosition={toggleMark} />

        <View style={styles.controls}>
          {isHost && (
            <Pressable style={[styles.btn, styles.secondary]} onPress={togglePause}>
              <Text style={[styles.btnText, { color: "#7a1f1f" }]}>
                {paused ? t("resume") : t("pause")}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.btn, styles.loteria, me.outForRound && { opacity: 0.3 }]}
            onPress={onClaim}
            disabled={me.outForRound}
          >
            <Text style={styles.btnText}>{t("loteria")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff8ef" },
  body: { flex: 1, padding: 8 },
  controls: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primary: { backgroundColor: "#c0392b" },
  secondary: { backgroundColor: "#fde6c8" },
  loteria: { backgroundColor: "#c0392b" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  winTitle: { fontSize: 22, color: "#fde6c8", fontWeight: "700" },
  winName: { fontSize: 42, color: "#fff", fontWeight: "900", marginVertical: 16 },
});
