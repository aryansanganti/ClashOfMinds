
export enum GameStatus {
  PLAYING = "PLAYING",
  WON = "WON",
  LOST = "LOST",
  INIT = "INIT"
}

export type ChallengeType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "TEXT_INPUT";
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type Gender = "RANDOM" | "MALE" | "FEMALE" | "NON_BINARY";

export interface Theme {
  setting: string;
  boss_name: string;
  boss_visual_prompt: string;
  player_visual_prompt: string;
  background_visual_prompt: string;
}

export interface Stats {
  // Boss HP is removed conceptually, we just track player health
  player_hp: number;
  player_max_hp: number;
  streak: number;
  current_turn_index: number; // 0-based index
  total_turns: number;
  turns_won: number;
  turns_lost: number;
}

// Data that changes every turn coming from AI
export interface TurnContent {
  turn_number: number;
  narrative_setup: string;
  question: string;
  challenge_type: ChallengeType;
  options?: string[]; // For MCQ
  correct_answer?: string; // For Client-side validation
  answer_explanation?: string; // Brief explanation of the correct answer
  difficulty: "EASY" | "MEDIUM" | "HARD";
  new_boss_visual_prompt?: string; // If the visual changes
  new_boss_name?: string; // Name for this turn's boss
}

export interface GameState {
  game_status: GameStatus;
  topic_title?: string; // Short 2-4 word topic title (e.g. "Cold War", "Python Basics")
  theme: Theme;
  stats: Stats;
  current_turn: TurnContent;
  context_summary?: string; // Stores the knowledge base from the file
  raid?: RaidState; // Co-op state
}

export interface InitGameParams {
  topic?: string;
  fileBase64?: string;
  mimeType?: string;
  numQuestions: number;
  difficulty: Difficulty;
  gender: Gender;
  age: string;
  ethnicity: string;
  mode?: 'SOLO' | 'COOP';
  players?: string[]; // Names of friends for Co-op
}

export interface DebugTurn {
  turn_number: number;
  content: TurnContent;
  bossImage: string | null;
}

export interface DebugState {
  theme: Theme;
  playerImage: string | null;
  backgroundImage: string | null;
  turns: DebugTurn[];
}

// Player Stats - Persisted to localStorage
export interface MissedQuestion {
  question: string;
  correctAnswer: string;
  playerAnswer: string;
  timestamp: number;
}

export interface TopicStats {
  topicName: string;
  firstPlayed: number;
  lastPlayed: number;
  gamesPlayed: number;
  turnsWon: number;
  turnsLost: number;
  totalTimeMs: number;
  missedQuestions: MissedQuestion[];
}

export interface PlayerStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  totalGamesLost: number;
  totalTurnsWon: number;
  totalTurnsLost: number;
  totalTimePlayedMs: number;
  longestStreak: number;
  topics: TopicStats[];
}

// Loading System Types
export interface LoadingProgress {
  step: string;
  current: number;
  total: number;
  percentage: number;
}

export interface PreloadedTurn {
  content: TurnContent;
  bossImage: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // URL or emoji
  hp: number;
  max_hp: number;
  role: "LEADER" | "MEMBER";
  is_bot: boolean;
  sub_topic?: string; // The specific sub-topic this player is handling
  status: "IDLE" | "ATTACKING" | "HIT" | "DEFEATED";
}

export interface RaidState {
  raid_id: string;
  boss_hp: number;
  boss_max_hp: number;
  players: Player[];
  status: "WAITING" | "IN_PROGRESS" | "VICTORY" | "DEFEAT";
  log: string[]; // Combat log messages
}

export interface FullGameManifest {
  gameState: GameState;
  allTurns: TurnContent[];
  raid?: RaidState; // Optional for Solo, required for Co-op
}
