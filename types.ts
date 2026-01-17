
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
  mana: number;              // Current mana
  max_mana: number;          // Maximum mana capacity
  active_powerups: ActivePowerup[];  // Currently active power-ups
}

// Power-up system
export type PowerupType = 'SHIELD';

export interface ActivePowerup {
  type: PowerupType;
  expires_turn?: number;  // For time-limited power-ups
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

// --- COMPETITION MODE TYPES ---

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string; // Emoji
  imageUrl?: string; // Generated 3D Character URL
  is_bot: boolean;
  score: number;
  progress: number; // 0-100%
}

export interface BotConfig {
  name: string;
  difficulty: Difficulty; // Determines how fast/accurate the bot answering is
  avatar: string;
}

export interface CompetitionRoomState {
  roomId: string;
  host: PlayerProfile;
  opponent: PlayerProfile | null;
  topic: string;
  difficulty: Difficulty;
  timeLimitSeconds: number;
  status: 'WAITING' | 'STARTING' | 'PLAYING' | 'FINISHED';
  winnerId?: string;
}

export interface CompetitionTurnResult {
  playerId: string;
  points: number;
  correct: boolean;
}

// --- DAILY QUEST TYPES ---
export type QuestType = 'STREAK' | 'TOPIC_ACCURACY' | 'TOTAL_CORRECT';

export interface Quest {
  id: string;
  description: string;
  type: QuestType;
  target: number;
  progress: number;
  topic?: string; // If specific topic required
  rewardXp: number;
  isCompleted: boolean;
// Scholar's Report Types
export interface StudyGuideSection {
  subTopic: string;
  explanation: string;
  keyPoints: string[];
  recommendedFocus: string;
}

export interface StudyGuide {
  overallPerformance: string;
  weakAreas: string[];
  sections: StudyGuideSection[];
  motivationalMessage: string;
}
