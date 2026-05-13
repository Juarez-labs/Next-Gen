import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CardImage } from "./CardImage";
import { TABLA_COLS } from "../game/engine";

export function TablaGrid({
  tabla,
  marks,
  onTogglePosition,
  cellSize = 72,
}: {
  tabla: number[];
  marks: boolean[];
  onTogglePosition: (position: number) => void;
  cellSize?: number;
}) {
  return (
    <View style={styles.grid}>
      {tabla.map((cardIndex, pos) => (
        <Pressable
          key={pos}
          onPress={() => onTogglePosition(pos)}
          style={[styles.cell, { width: `${100 / TABLA_COLS}%` }]}
          hitSlop={4}
        >
          <CardImage cardIndex={cardIndex} size={cellSize} marked={marks[pos]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { padding: 4, alignItems: "center" },
});
