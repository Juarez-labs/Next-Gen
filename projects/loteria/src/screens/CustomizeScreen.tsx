import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CARDS } from "../data/cards";
import { CardImage, useCustomCards } from "../components/CardImage";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { supabase } from "../lib/supabase";
import { generateCardImage } from "../lib/openai";

export function CustomizeScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { getCustom, reload } = useCustomCards();
  const [selected, setSelected] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    if (selected == null || !user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    setBusy(true);
    try {
      const bytes = Uint8Array.from(atob(res.assets[0].base64), (c) => c.charCodeAt(0));
      const path = `${user.id}/${selected}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("card-art")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("card-art").getPublicUrl(path);
      await supabase.from("custom_cards").upsert({
        user_id: user.id,
        card_index: selected,
        image_url: data.publicUrl,
        source: "photo",
      });
      await reload();
    } catch (e: any) {
      Alert.alert("Upload failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const generateAI = async () => {
    if (selected == null || !user) return;
    setBusy(true);
    try {
      const res = await generateCardImage({
        cardName: CARDS[selected].name,
        prompt: prompt || `Funny family-friendly version of ${CARDS[selected].name}`,
        cardIndex: selected,
      });
      if (!res) throw new Error("AI generation failed");
      await supabase.from("custom_cards").upsert({
        user_id: user.id,
        card_index: selected,
        image_url: res.imageUrl,
        source: "ai",
        prompt,
      });
      await reload();
    } catch (e: any) {
      Alert.alert("Generation failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (selected == null || !user) return;
    await supabase.from("custom_cards").delete().match({ user_id: user.id, card_index: selected });
    await reload();
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.grid}>
        {CARDS.map((c) => (
          <Pressable
            key={c.index}
            style={[styles.cell, selected === c.index && styles.selected]}
            onPress={() => setSelected(c.index)}
          >
            <CardImage cardIndex={c.index} size={80} />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.panel}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        {selected != null ? (
          <>
            <Text style={styles.title}>{CARDS[selected].name}</Text>
            <TextInput
              placeholder="Describe how this card should look…"
              value={prompt}
              onChangeText={setPrompt}
              style={styles.input}
              multiline
            />
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, styles.primary]} onPress={pickPhoto} disabled={busy}>
                <Text style={styles.btnText}>{t("uploadPhoto")}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.primary]} onPress={generateAI} disabled={busy}>
                <Text style={styles.btnText}>{t("generateWithAI")}</Text>
              </Pressable>
            </View>
            {getCustom(selected) && (
              <Pressable onPress={reset}>
                <Text style={styles.linkRed}>{t("resetToDefault")}</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={styles.hint}>Tap a card to customize it.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff8ef" },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  cell: { padding: 2, borderRadius: 8 },
  selected: { backgroundColor: "#fde6c8", borderWidth: 2, borderColor: "#c0392b" },
  panel: { borderTopWidth: 1, borderColor: "#e0d8c8", padding: 16, backgroundColor: "#fff" },
  back: { color: "#7a1f1f", fontSize: 16, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#7a1f1f", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 10,
    padding: 10,
    minHeight: 50,
    marginBottom: 12,
  },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  primary: { backgroundColor: "#c0392b" },
  btnText: { color: "#fff", fontWeight: "700" },
  hint: { color: "#7a6a52" },
  linkRed: { color: "#c0392b", textAlign: "center", marginTop: 12, textDecorationLine: "underline" },
});
