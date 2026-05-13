import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Game, Player, WinMode } from "../game/types";
import { generateCallOrder, generateGameCode, generateTabla, isValidWin } from "../game/engine";
import { useAuth } from "./AuthContext";

type GameValue = {
  game: Game | null;
  players: Player[];
  me: Player | null;
  calledIndices: number[];           // card indices called so far, in order

  hostGame: (opts: { winMode: WinMode; tempoMs: number; falseClaimPenalty: boolean }) => Promise<Game>;
  joinGame: (code: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  startGame: () => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  callNext: () => Promise<void>;     // host-only manual advance
  toggleMark: (position: number) => Promise<void>;
  claimWin: () => Promise<{ won: boolean }>;
};

const GameContext = createContext<GameValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  const me = useMemo(
    () => players.find((p) => p.userId === user?.id) ?? null,
    [players, user?.id]
  );

  const calledIndices = useMemo(() => {
    if (!game) return [];
    return game.callOrder?.slice(0, game.currentCallIndex) ?? [];
  }, [game]);

  // Subscribe to game + player changes whenever we're in a game.
  useEffect(() => {
    if (!game?.id) return;
    const channel = supabase
      .channel(`game:${game.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        (payload) => {
          if (payload.new) setGame(rowToGame(payload.new as any));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${game.id}` },
        async () => {
          await refreshPlayers(game.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  // Auto-caller timer: host runs it locally and persists currentCallIndex.
  useEffect(() => {
    if (!game) return;
    if (game.status !== "playing") return;
    if (game.hostId !== user?.id) return;     // only host advances
    if (pausedRef.current) return;
    if (game.currentCallIndex >= game.callOrder.length) return;

    timerRef.current = setTimeout(() => {
      void callNext();
    }, game.tempoMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [game?.status, game?.currentCallIndex, game?.tempoMs, user?.id]);

  const refreshPlayers = async (gameId: string) => {
    const { data, error } = await supabase
      .from("game_players")
      .select("user_id, tabla, marks, out_for_round, profiles(display_name)")
      .eq("game_id", gameId);
    if (error || !data) return;
    setPlayers(
      data.map((row: any) => ({
        userId: row.user_id,
        displayName: row.profiles?.display_name ?? "Jugador",
        tabla: row.tabla,
        marks: row.marks,
        outForRound: row.out_for_round,
      }))
    );
  };

  const hostGame: GameValue["hostGame"] = async (opts) => {
    if (!user) throw new Error("not authed");
    const code = generateGameCode();
    const callOrder = generateCallOrder();
    const { data, error } = await supabase
      .from("games")
      .insert({
        code,
        host_id: user.id,
        status: "lobby",
        win_mode: opts.winMode,
        tempo_ms: opts.tempoMs,
        false_claim_penalty: opts.falseClaimPenalty,
        call_order: callOrder,
        current_call_index: 0,
      })
      .select()
      .single();
    if (error || !data) throw error;
    // host auto-joins with a tabla
    await supabase.from("game_players").insert({
      game_id: data.id,
      user_id: user.id,
      tabla: generateTabla(),
    });
    const g = rowToGame(data);
    setGame(g);
    await refreshPlayers(g.id);
    return g;
  };

  const joinGame: GameValue["joinGame"] = async (code) => {
    if (!user) throw new Error("not authed");
    const { data: g, error } = await supabase
      .from("games")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();
    if (error || !g) throw error ?? new Error("game not found");
    await supabase.from("game_players").upsert({
      game_id: g.id,
      user_id: user.id,
      tabla: generateTabla(),
    });
    const game = rowToGame(g);
    setGame(game);
    await refreshPlayers(game.id);
  };

  const leaveGame: GameValue["leaveGame"] = async () => {
    if (!game || !user) return;
    await supabase.from("game_players").delete().match({ game_id: game.id, user_id: user.id });
    if (timerRef.current) clearTimeout(timerRef.current);
    setGame(null);
    setPlayers([]);
  };

  const startGame: GameValue["startGame"] = async () => {
    if (!game || !user || game.hostId !== user.id) return;
    pausedRef.current = false;
    const { error } = await supabase
      .from("games")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", game.id);
    if (error) throw error;
  };

  const pauseTimer = () => {
    pausedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const resumeTimer = () => {
    pausedRef.current = false;
    // bump state to retrigger the effect
    setGame((g) => (g ? { ...g } : g));
  };

  const callNext: GameValue["callNext"] = async () => {
    if (!game || !user || game.hostId !== user.id) return;
    if (game.currentCallIndex >= game.callOrder.length) return;
    const next = game.currentCallIndex + 1;
    const { error } = await supabase
      .from("games")
      .update({ current_call_index: next })
      .eq("id", game.id);
    if (error) throw error;
  };

  const toggleMark: GameValue["toggleMark"] = async (position) => {
    if (!game || !me || !user) return;
    const marks = [...me.marks];
    marks[position] = !marks[position];
    await supabase
      .from("game_players")
      .update({ marks })
      .match({ game_id: game.id, user_id: user.id });
  };

  const claimWin: GameValue["claimWin"] = async () => {
    if (!game || !me || !user) return { won: false };
    const called = new Set(calledIndices);
    const ok = isValidWin({
      tabla: me.tabla,
      marks: me.marks,
      calledCardIndices: called,
      winMode: game.winMode,
    });
    if (ok) {
      await supabase
        .from("games")
        .update({
          status: "finished",
          winner_id: user.id,
          finished_at: new Date().toISOString(),
        })
        .eq("id", game.id);
      return { won: true };
    }
    if (game.falseClaimPenalty) {
      await supabase
        .from("game_players")
        .update({ out_for_round: true })
        .match({ game_id: game.id, user_id: user.id });
    }
    return { won: false };
  };

  return (
    <GameContext.Provider
      value={{
        game,
        players,
        me,
        calledIndices,
        hostGame,
        joinGame,
        leaveGame,
        startGame,
        pauseTimer,
        resumeTimer,
        callNext,
        toggleMark,
        claimWin,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame outside GameProvider");
  return ctx;
}

function rowToGame(row: any): Game {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    winMode: row.win_mode,
    tempoMs: row.tempo_ms,
    currentCallIndex: row.current_call_index,
    falseClaimPenalty: row.false_claim_penalty,
    winnerId: row.winner_id ?? null,
    createdAt: row.created_at,
    callOrder: row.call_order ?? [],
  };
}
