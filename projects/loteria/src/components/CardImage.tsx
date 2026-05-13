import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { CARDS } from "../data/cards";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// Cache custom-card URLs per session so we don't refetch on every render.
const customCache = new Map<number, string | null>();
const subscribers = new Set<() => void>();

async function loadCustom(userId: string) {
  const { data } = await supabase
    .from("custom_cards")
    .select("card_index, image_url")
    .eq("user_id", userId);
  customCache.clear();
  (data ?? []).forEach((row: any) => customCache.set(row.card_index, row.image_url));
  subscribers.forEach((fn) => fn());
}

export function useCustomCards() {
  const { user } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    void loadCustom(user.id);
    const fn = () => setTick((t) => t + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, [user?.id]);
  return {
    getCustom: (cardIndex: number) => customCache.get(cardIndex) ?? null,
    reload: () => (user ? loadCustom(user.id) : Promise.resolve()),
  };
}

export function CardImage({
  cardIndex,
  size = 84,
  marked = false,
}: {
  cardIndex: number;
  size?: number;
  marked?: boolean;
}) {
  const { getCustom } = useCustomCards();
  const card = CARDS[cardIndex];
  const url = getCustom(cardIndex);

  return (
    <View style={[styles.card, { width: size, height: size * 1.2 }, marked && styles.marked]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIdx}>{cardIndex + 1}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {card.name}
      </Text>
      {marked && <View style={styles.bean} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#7a1f1f",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  marked: { opacity: 0.85 },
  img: { ...StyleSheet.absoluteFillObject },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fde6c8",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIdx: { fontSize: 28, fontWeight: "800", color: "#7a1f1f" },
  name: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "rgba(122,31,31,0.85)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: "stretch",
    textAlign: "center",
  },
  bean: {
    position: "absolute",
    width: "55%",
    height: "55%",
    borderRadius: 999,
    backgroundColor: "rgba(220, 53, 69, 0.55)",
    borderWidth: 2,
    borderColor: "#7a1f1f",
  },
});
