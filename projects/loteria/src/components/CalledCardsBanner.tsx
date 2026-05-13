import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CARDS } from "../data/cards";
import { CardImage } from "./CardImage";

export function CalledCardsBanner({ calledIndices }: { calledIndices: number[] }) {
  const ref = useRef<ScrollView>(null);
  const current = calledIndices.at(-1);

  useEffect(() => {
    // keep the latest card visible
    setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 50);
  }, [calledIndices.length]);

  return (
    <View style={styles.wrap}>
      <View style={styles.current}>
        {current != null ? (
          <>
            <CardImage cardIndex={current} size={120} />
            <Text style={styles.currentName}>{CARDS[current].name}</Text>
          </>
        ) : (
          <Text style={styles.waiting}>Esperando…</Text>
        )}
      </View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.history}
      >
        {calledIndices.slice(0, -1).map((idx, i) => (
          <View key={`${idx}-${i}`} style={styles.histItem}>
            <CardImage cardIndex={idx} size={48} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#7a1f1f",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  current: { alignItems: "center", marginBottom: 8 },
  currentName: { color: "#fff", fontWeight: "800", fontSize: 20, marginTop: 6 },
  waiting: { color: "#fde6c8", fontSize: 16, paddingVertical: 60 },
  history: { paddingVertical: 4, gap: 6 },
  histItem: { marginRight: 6 },
});
