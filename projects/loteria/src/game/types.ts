export type WinMode = "corners" | "row" | "full";

export type GameStatus = "lobby" | "playing" | "finished";

export type TabladaCell = {
  cardIndex: number;
  marked: boolean;
};

export type Game = {
  id: string;
  code: string;            // 6-char share code
  hostId: string;
  status: GameStatus;
  winMode: WinMode;
  tempoMs: number;         // ms between calls
  currentCallIndex: number; // how many cards called so far
  callOrder: number[];     // shuffled deck (54 card indices)
  falseClaimPenalty: boolean;
  winnerId: string | null;
  createdAt: string;
};

export type Player = {
  userId: string;
  displayName: string;
  tabla: number[];         // 16 card indices
  marks: boolean[];        // 16 booleans, marked or not
  outForRound: boolean;
};

export type CalledCard = {
  position: number;        // order called
  cardIndex: number;
  calledAt: string;
};
