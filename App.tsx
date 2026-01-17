import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, TurnContent, Difficulty, Gender, PlayerStats, LoadingProgress as LoadingProgressType, PreloadedTurn, CompetitionRoomState } from './types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/components/LoginScreen';

import { GameState, GameStatus, TurnContent, Difficulty, Gender, PlayerStats, LoadingProgress as LoadingProgressType, PreloadedTurn } from './types';
import { initializeGame, generateGameImage } from './services/geminiService';
import { loadStats, recordGameStart, recordTurnResult, recordGameEnd } from './services/statsService';
import { saveGameState, loadGameState, clearSavedGame, hasSavedGame, SavedGameData } from './services/saveService';
import { GameScreen } from './components/GameScreen';
import { StatsPanel } from './components/StatsPanel';
import { LoadingProgress } from './components/LoadingProgress';
import { LobbyScreen } from './components/LobbyScreen';
import { CompetitionSetup } from './components/CompetitionSetup';
import { CompetitionGameScreen } from './components/CompetitionGameScreen';
import { SparklesIcon, PhotoIcon, Cog6ToothIcon, DocumentTextIcon, XMarkIcon, ClipboardDocumentListIcon, TrophyIcon, Bars3Icon, SpeakerWaveIcon, SpeakerXMarkIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import { SparklesIcon, PhotoIcon, Cog6ToothIcon, DocumentTextIcon, XMarkIcon, ClipboardDocumentListIcon, TrophyIcon, Bars3Icon, SpeakerWaveIcon, SpeakerXMarkIcon, UserGroupIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';
import { Swords } from 'lucide-react';
import { useSoundManager } from './hooks/useSoundManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { generateDailyQuests } from './services/geminiService';
import { Quest } from './types';
import { FireIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

// Error popup for quota/rate limit errors
interface ApiError {
  code: number;
  status: string;
  message: string;
}

const GameApp: React.FC = () => {
  // Hooks must run unconditionally
  const { logout, currentUser } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'MENU' | 'GAME' | 'LOBBY' | 'COMPETITION_SETUP' | 'COMPETITION_GAME'>('MENU');
  const [raidFriends, setRaidFriends] = useState<string[]>([]);
  const [competitionRoom, setCompetitionRoom] = useState<CompetitionRoomState | null>(null);

  // Save/Resume state
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedGameData, setSavedGameData] = useState<SavedGameData | null>(null);

  // Sound Manager
  const soundManager = useSoundManager();
  const multiplayer = useMultiplayer();

  const [loading, setLoading] = useState(false);

  const [loadingProgress, setLoadingProgress] = useState<LoadingProgressType | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  // Input State
  const [topic, setTopic] = useState('');
  const [pastedContent, setPastedContent] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Settings
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [gender, setGender] = useState<Gender>('RANDOM');
  const [age, setAge] = useState<number>(10);
  const [randomAge, setRandomAge] = useState<boolean>(true);
  const [ethnicity, setEthnicity] = useState<string>('Random');

  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);

  // Player Stats
  const [playerStats, setPlayerStats] = useState<PlayerStats>(() => loadStats());
  const gameStartTime = useRef<number>(0);
  const currentTopicName = useRef<string>('');
  const currentSessionMissedQuestions = useRef<MissedQuestion[]>([]);

  // Image Assets (Game Mode)
  const [bossImage, setBossImage] = useState<string | null>(null);
  const [playerImage, setPlayerImage] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  // Pre-loaded turns with images (replaces buffer system)
  const preloadedTurns = useRef<PreloadedTurn[]>([]);

  // Track the next turn index that should be loaded (set before state updates)
  const pendingNextTurnIndex = useRef<number>(-1);

  // Abort controller for cancelling background operations
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- QUESTS INITIALIZATION ---
  useEffect(() => {
    const initQuests = async () => {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `battlenotes_quests_${today}`;
      const savedQuests = localStorage.getItem(storageKey);

      if (savedQuests) {
        setQuests(JSON.parse(savedQuests));
      } else {
        try {
          const newQuests = await generateDailyQuests();
          setQuests(newQuests);
          localStorage.setItem(storageKey, JSON.stringify(newQuests));
        } catch (e) {
          console.error("Failed to init quests", e);
        }
      }
    };
    initQuests();
  }, []);

  const updateQuestProgress = (type: Quest['type'], amount: number, contextTopic?: string) => {
    setQuests(prev => {
      const updated = prev.map(q => {
        if (q.isCompleted) return q;

        let match = false;
        if (q.type === 'TOTAL_CORRECT' && type === 'TOTAL_CORRECT') match = true;
        if (q.type === 'STREAK' && type === 'STREAK') match = true;
        if (q.type === 'TOPIC_ACCURACY' && type === 'TOPIC_ACCURACY' && contextTopic && q.topic) {
          if (contextTopic.toLowerCase().includes(q.topic.toLowerCase()) || q.topic.toLowerCase().includes(contextTopic.toLowerCase())) {
            match = true;
          }
        }

        if (match) {
          const newProgress = Math.min(q.target, q.progress + amount);
          const isCompleted = newProgress >= q.target;
          if (isCompleted && !q.isCompleted) {
            soundManager.playVictory();
          }
          return { ...q, progress: newProgress, isCompleted };
        }
        return q;
      });

      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`battlenotes_quests_${today}`, JSON.stringify(updated));
      return updated;
    });
  };
  // Check for saved game on mount
  useEffect(() => {
    console.log('[Resume Check] Effect triggered:', { currentUser: !!currentUser, view, gameState: !!gameState });
    if (currentUser && view === 'MENU' && !gameState) {
      const hasSave = hasSavedGame(currentUser.uid);
      console.log('[Resume Check] Has saved game:', hasSave);
      if (hasSave) {
        const saved = loadGameState(currentUser.uid);
        console.log('[Resume Check] Loaded save data:', saved);
        if (saved) {
          setSavedGameData(saved);
          setShowResumeModal(true);
        }
      }
    }
  }, [currentUser, view, gameState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      // Clear topic and pasted content when file is uploaded
      setTopic('');
      setPastedContent(null);
    }
  };

  const clearFile = () => {
    if (loading) return;
    setFile(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
  };

  // --- SMART PASTE LOGIC ---
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');

    if (text.length > 100) {
      setPastedContent(text);
      // If there was previous text, keep it or append? 
      // User request: "if he proceeds to write after the paste, take it and keep showing"
      // We'll just set pastedContent and let user type in the input box for extra instructions.
      if (!topic) setTopic(" "); // Ensure input isn't empty so it focuses
    } else {
      // Normal paste
      const start = e.currentTarget.selectionStart || 0;
      const end = e.currentTarget.selectionEnd || 0;
      const newValue = topic.substring(0, start) + text + topic.substring(end);
      setTopic(newValue);
    }
  };

  const handleClearPasted = () => {
    setPastedContent(null);
    setTopic("");
  };

  // --- 1. GENERATION LOGIC ---
  const handleStartGame = async (mode: 'SOLO' | 'COOP' = 'SOLO', friends: string[] = []) => {
    if (!topic && !file && !pastedContent) return;

    soundManager.playButtonClick();

    // START LOADING MUSIC
    soundManager.playLoadingMusic();

    setLoading(true);
    preloadedTurns.current = [];

    // Calculate total steps: 1 (master JSON) + 2 (player + bg) + numQuestions (boss images)
    const totalSteps = 1 + 2 + numQuestions;
    let currentStep = 0;

    const updateProgress = (step: string) => {
      currentStep++;
      setLoadingProgress({
        step,
        current: currentStep,
        total: totalSteps,
        percentage: (currentStep / totalSteps) * 100
      });
    };

    // Reset states
    setGameState(null);
    setBossImage(null);
    setPlayerImage(null);
    setBackgroundImage(null);

    let fileBase64: string | undefined, mimeType: string | undefined;
    if (file) {
      fileBase64 = await fileToBase64(file);
      mimeType = file.type;
    }

    // Combine Paste + Topic
    let finalTopic = topic;
    if (pastedContent) {
      finalTopic = `Context: ${pastedContent}\n\nAdditional Instruction: ${topic}`;
    }

    const initParams = {
      topic: finalTopic || undefined,
      fileBase64,
      mimeType,
      difficulty,
      numQuestions,
      gender,
      age: randomAge ? 'Random' : String(age),
      ethnicity,
      mode,
      players: friends
    };

    // Step 1: Generate master JSON with all turns
    setLoadingProgress({
      step: 'Generating questions...',
      current: 0,
      total: totalSteps,
      percentage: 5  // Start at 5% to show immediate progress
    });

    const MAX_RETRIES = 2;
    let manifest: { gameState: GameState; allTurns: TurnContent[] } | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        setLoadingProgress({
          step: attempt > 1 ? `Retrying... (${attempt}/${MAX_RETRIES})` : 'Generating questions...',
          current: 0,
          total: totalSteps,
          percentage: 5  // Start at 5%
        });
        manifest = await initializeGame(initParams);
        updateProgress('Questions generated!');
        break;
      } catch (err: any) {
        console.error(`Attempt ${attempt} failed:`, err);

        const errorMessage = err?.message || String(err);
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
          setLoading(false);
          setLoadingProgress(null);
          // Stop loading music on error
          soundManager.stopMusic();
          setApiError({
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'API quota exceeded. Please try again later.'
          });
          return;
        }

        if (attempt === MAX_RETRIES) {
          setLoading(false);
          setLoadingProgress(null);
          soundManager.stopMusic();
          alert("Failed to generate game after multiple attempts. Please try again.");
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!manifest) {
      setLoading(false);
      setLoadingProgress(null);
      soundManager.stopMusic();
      return;
    }

    const { gameState: initialGameState, allTurns } = manifest;

    try {
      // Step 2-3: Generate base assets in parallel
      setLoadingProgress({
        step: 'Creating player character...',
        current: currentStep,
        total: totalSteps,
        percentage: (currentStep / totalSteps) * 100
      });

      const [playerImg, bgImg] = await Promise.all([
        generateGameImage(initialGameState.theme.player_visual_prompt, false, 'right'),
        generateGameImage(initialGameState.theme.background_visual_prompt, true)
      ]);
      updateProgress('Player created!');
      updateProgress('Background created!');

      // Step 4+: Generate all boss images in parallel
      setLoadingProgress({
        step: 'Loading boss images...',
        current: currentStep,
        total: totalSteps,
        percentage: (currentStep / totalSteps) * 100
      });

      // Generate all boss images in parallel
      const bossImagePromises = allTurns.map((turn, index) =>
        generateGameImage(turn.new_boss_visual_prompt || initialGameState.theme.boss_visual_prompt, false, 'left')
          .then(img => {
            updateProgress(`Boss ${index + 1} loaded`);
            return img;
          })
      );

      const bossImages = await Promise.all(bossImagePromises);

      // Store all preloaded turns
      preloadedTurns.current = allTurns.map((turn, index) => ({
        content: turn,
        bossImage: bossImages[index]
      }));

      // Set initial state
      setPlayerImage(playerImg);
      setBackgroundImage(bgImg);
      setBossImage(bossImages[0]); // First boss image
      setGameState(initialGameState);
      setView('GAME');

      // PLAY TRANSITION THEN START BATTLE MUSIC
      soundManager.playTransition();
      setTimeout(() => {
        soundManager.playBattleMusic();
      }, 600); // Sync roughly with end of transition swoosh

      // Track game start
      const topicName = file?.name || topic || pastedContent?.substring(0, 50) || 'Unknown Topic';
      currentTopicName.current = topicName;
      gameStartTime.current = Date.now();
      currentSessionMissedQuestions.current = []; // Reset missed questions for new game
      const newStats = recordGameStart(topicName);
      setPlayerStats(newStats);

    } catch (err: any) {
      console.error(err);
      soundManager.stopMusic();
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        setApiError({
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'API quota exceeded. Please try again later.'
        });
      } else {
        alert("Failed to create game assets. Please try again.");
      }
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const competitionTurns = useRef<TurnContent[]>([]);

  // --- COMPETITION LOGIC ---
  const handleCompetitionStart = async (roomState: CompetitionRoomState) => {
    // For competition, we'll quickly generate a game or use a pre-set one.
    // For now, let's reuse initialization but with a "fast" flag or similar, 
    // OR just generate a game with the room's settings.
    setCompetitionRoom(roomState);

    // Trigger generation (similar to handleStartGame but specific for competition)
    // We'll reuse the existing flow but redirect to COMPETITION_GAME

    setLoading(true);
    setLoadingProgress({ step: 'Preparing Battle...', current: 0, total: 100, percentage: 50 });

    try {
      const initParams = {
        topic: roomState.topic,
        difficulty: roomState.difficulty,
        numQuestions: 10, // Fixed for battle
        gender: 'RANDOM' as Gender,
        age: '18',
        ethnicity: 'Random',
        mode: 'SOLO' as const // The mock component handles the "opponent" visually
      };

      const manifest = await initializeGame(initParams);
      setGameState(manifest.gameState);
      competitionTurns.current = manifest.allTurns; // Store all turns for instant switching

      // Skip heavy image generation for speed? Or just generate one bg/boss?
      // Let's generate just the essentials
      const bgImg = await generateGameImage(manifest.gameState.theme.background_visual_prompt, true);
      setBackgroundImage(bgImg);

      setView('COMPETITION_GAME');
    } catch (e) {
      console.error("Competition Init Error", e);
      alert("Failed to start battle. Please try again.");
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const handleCompetitionEnd = (winnerId: string, pScore: number, oScore: number) => {
    // Record stats?
    setView('MENU');
    setCompetitionRoom(null);
  };


  // --- 2. CLIENT SIDE GAME LOGIC ---
  const handleAction = (answer: string, isCorrect: boolean) => {
    if (!gameState) return;

    let newBossHp = 0;
    let newPlayerHp = gameState.stats.player_hp;
    let newStatus = GameStatus.PLAYING;

    const nextIndex = gameState.stats.current_turn_index + 1;

    if (isCorrect) {
      newBossHp = 0;
      if (nextIndex >= gameState.stats.total_turns) {
        newStatus = GameStatus.WON;
      }
    } else {
      // Check for active Shield power-up
      const hasShield = gameState.stats.active_powerups.some(p => p.type === 'SHIELD');

      if (hasShield) {
        // Shield negates damage!
        newPlayerHp = gameState.stats.player_hp;
        // Remove shield after use
        gameState.stats.active_powerups = gameState.stats.active_powerups.filter(p => p.type !== 'SHIELD');
      } else {
        // Damage system based on difficulty
        const totalQuestions = Math.max(1, gameState.stats.total_turns);
        let allowedMistakes: number;
        if (difficulty === 'EASY') {
          allowedMistakes = Math.max(3, Math.ceil(totalQuestions * 0.6));
        } else if (difficulty === 'HARD') {
          allowedMistakes = Math.max(2, Math.ceil(totalQuestions * 0.25));
        } else {
          allowedMistakes = Math.max(2, Math.ceil(totalQuestions * 0.4));
        }

        const damage = Math.ceil(gameState.stats.player_max_hp / allowedMistakes);
        newPlayerHp = Math.max(0, gameState.stats.player_hp - damage);
      }

      if (newPlayerHp <= 0) {
        newStatus = GameStatus.LOST;
      } else if (nextIndex >= gameState.stats.total_turns) {
        newStatus = GameStatus.WON;
      }
      newBossHp = 100;
    }

    // Track turn result
    const newStreak = isCorrect ? gameState.stats.streak + 1 : 0;

    // Update Quests - TOTAL_CORRECT & TOPIC
    if (isCorrect) {
      updateQuestProgress('TOTAL_CORRECT', 1);
      updateQuestProgress('TOPIC_ACCURACY', 1, currentTopicName.current);
    }

    // Update Quests - STREAK
    // We handle streak specially because we want to update if current streak > quest progress
    if (newStreak > gameState.stats.streak) {
      setQuests(prev => {
        const updated = prev.map(q => {
          if (q.type === 'STREAK' && !q.isCompleted && newStreak > q.progress) {
            const newP = Math.min(q.target, newStreak);
            return { ...q, progress: newP, isCompleted: newP >= q.target };
          }
          return q;
        });
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`battlenotes_quests_${today}`, JSON.stringify(updated));
        return updated;
      });
    }

    const turnStats = recordTurnResult(
      currentTopicName.current,
      isCorrect,
      newStreak,
      gameState.current_turn.question,
      gameState.current_turn.correct_answer,
      answer
    );
    setPlayerStats(turnStats);

    // Track missed question in current session
    if (!isCorrect) {
      currentSessionMissedQuestions.current.push({
        question: gameState.current_turn.question,
        correctAnswer: gameState.current_turn.correct_answer || '',
        playerAnswer: answer,
        timestamp: Date.now()
      });
    }

    if (newStatus === GameStatus.WON || newStatus === GameStatus.LOST) {
      const timePlayedMs = Date.now() - gameStartTime.current;
      const endStats = recordGameEnd(currentTopicName.current, newStatus === GameStatus.WON, timePlayedMs);
      setPlayerStats(endStats);
      // Stop BGM on game over
      soundManager.stopMusic();
      // Clear saved game when game ends
      if (currentUser) {
        clearSavedGame(currentUser.uid);
      }
    }

    // Store the next turn index BEFORE state update (for handleTransitionComplete to use)
    pendingNextTurnIndex.current = nextIndex;
    console.log("handleAction - setting pendingNextTurnIndex to:", nextIndex);

    // Calculate mana change
    const manaGain = isCorrect ? 20 : 0;
    const newMana = Math.min(gameState.stats.max_mana, gameState.stats.mana + manaGain);

    // Remove expired power-ups
    const activePowerups = gameState.stats.active_powerups.filter(
      p => !p.expires_turn || p.expires_turn > gameState.stats.current_turn_index + 1
    );

    setGameState(prev => prev ? ({
      ...prev,
      game_status: newStatus,
      stats: {
        ...prev.stats,
        player_hp: newPlayerHp,
        streak: newStreak,
        current_turn_index: prev.stats.current_turn_index + 1,
        turns_won: isCorrect ? prev.stats.turns_won + 1 : prev.stats.turns_won,
        turns_lost: isCorrect ? prev.stats.turns_lost : prev.stats.turns_lost + 1,
        mana: newMana,
        active_powerups: activePowerups
      }
    }) : null);

    // Auto-save after each turn (if game is still playing)
    if (newStatus === GameStatus.PLAYING && currentUser) {
      setTimeout(() => {
        // Save the updated game state
        const updatedGameState: GameState = {
          ...gameState,
          game_status: newStatus,
          stats: {
            ...gameState.stats,
            player_hp: newPlayerHp,
            streak: newStreak,
            current_turn_index: gameState.stats.current_turn_index + 1,
            turns_won: isCorrect ? gameState.stats.turns_won + 1 : gameState.stats.turns_won,
            turns_lost: isCorrect ? gameState.stats.turns_lost : gameState.stats.turns_lost + 1
          }
        };

        // Strip boss images from preloadedTurns to save space
        const turnsWithoutImages = preloadedTurns.current.map(turn => ({
          content: turn.content,
          bossImage: '' // Remove image to save space
        }));

        saveGameState(currentUser.uid, {
          gameState: updatedGameState,
          preloadedTurns: turnsWithoutImages,
          timestamp: Date.now(),
          userId: currentUser.uid
        });
      }, 100); // Small delay to ensure state is updated
    }
  };

  const handleTransitionComplete = () => {
    if (view !== 'GAME') return;

    // Use the pendingNextTurnIndex ref which was set BEFORE the state update in handleAction
    const nextTurnIndex = pendingNextTurnIndex.current;

    console.log("handleTransitionComplete - using pendingNextTurnIndex:", nextTurnIndex, "preloadedTurns length:", preloadedTurns.current.length);

    if (nextTurnIndex >= 0 && nextTurnIndex < preloadedTurns.current.length) {
      const nextTurn = preloadedTurns.current[nextTurnIndex];
      console.log("Applying preloaded turn:", nextTurn.content.turn_number, "question:", nextTurn.content.question?.substring(0, 30));

      // Update boss image
      setBossImage(nextTurn.bossImage);

      // Update game state with new turn content
      setGameState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          current_turn: nextTurn.content
        };
      });

      // Reset pending index
      pendingNextTurnIndex.current = -1;
    } else {
      console.log("No turn to load - nextTurnIndex:", nextTurnIndex, "is out of range or -1");
    }
  };

  const handleReset = () => {
    // Abort any ongoing background operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    soundManager.stopMusic();
    setView('MENU');
    setGameState(null);
    setBossImage(null);
    setPlayerImage(null);
    setBackgroundImage(null);
    preloadedTurns.current = [];
    pendingNextTurnIndex.current = -1;
    setLoadingProgress(null);
    currentSessionMissedQuestions.current = []; // Reset missed questions when returning to menu
  };

  // Resume saved game
  const handleResumeGame = async () => {
    if (!savedGameData) return;

    soundManager.playButtonClick();
    setShowResumeModal(false);
    setLoading(true);

    try {
      // Restore game state first
      setGameState(savedGameData.gameState);

      // Regenerate ALL boss images since we don't save them
      const bossImagePromises = savedGameData.preloadedTurns.map((turn) =>
        generateGameImage(
          turn.content.new_boss_visual_prompt || savedGameData.gameState.theme.boss_visual_prompt,
          false,
          'left'
        )
      );

      const [playerImg, bgImg, ...bossImages] = await Promise.all([
        generateGameImage(savedGameData.gameState.theme.player_visual_prompt, false, 'right'),
        generateGameImage(savedGameData.gameState.theme.background_visual_prompt, true),
        ...bossImagePromises
      ]);

      // Restore preloaded turns with regenerated images
      preloadedTurns.current = savedGameData.preloadedTurns.map((turn, index) => ({
        content: turn.content,
        bossImage: bossImages[index]
      }));

      const currentTurnIndex = savedGameData.gameState.stats.current_turn_index;
      setBossImage(bossImages[currentTurnIndex]);
      setPlayerImage(playerImg);
      setBackgroundImage(bgImg);

      // Set up game tracking
      const topicName = savedGameData.gameState.topic_title || 'Resumed Game';
      currentTopicName.current = topicName;
      gameStartTime.current = Date.now();

      setView('GAME');
      setLoading(false);

      // Play battle music
      soundManager.playTransition();
      setTimeout(() => {
        soundManager.playBattleMusic();
      }, 600);

      setSavedGameData(null);
    } catch (error) {
      console.error('Error resuming game:', error);
      setLoading(false);
      alert('Failed to resume game. Please try starting a new game.');
    }
  };

  // Start new game (clear save)
  const handleStartNewGame = () => {
    if (currentUser) {
      clearSavedGame(currentUser.uid);
    }
    soundManager.playButtonClick();
    setShowResumeModal(false);
    setSavedGameData(null);
  };

  // Save and quit
  const handleSaveAndQuit = () => {
    if (!gameState || !currentUser) return;

    soundManager.playButtonClick();

    // Save current game state (WITHOUT images)
    // Strip boss images from preloadedTurns to save space
    const turnsWithoutImages = preloadedTurns.current.map(turn => ({
      content: turn.content,
      bossImage: '' // Remove image to save space
    }));

    saveGameState(currentUser.uid, {
      gameState,
      preloadedTurns: turnsWithoutImages,
      timestamp: Date.now(),
      userId: currentUser.uid
    });

    // Return to menu
    handleReset();
  };

  // Power-up purchase functions
  const handleUsePowerup = (type: 'SHIELD') => {
    if (!gameState) return;

    const cost = 30; // Shield cost

    if (gameState.stats.mana < cost) {
      alert('Not enough mana!');
      return;
    }

    soundManager.playButtonClick();

    setGameState(prev => prev ? ({
      ...prev,
      stats: {
        ...prev.stats,
        mana: prev.stats.mana - cost,
        active_powerups: [...prev.stats.active_powerups, { type }]
      }
    }) : null);
  };

  const handleOpenLobby = () => {
    if (!topic && !file && !pastedContent) return;
    soundManager.playButtonClick();
    setView('LOBBY');
  };

  const handleDismissApiError = () => {
    setApiError(null);
    handleReset();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-sky-200">
      {/* API Error Popup */}
      {apiError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="inline-block p-4 rounded-full bg-red-100 mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">API Limit Reached</h3>
            <div className="bg-slate-100 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm text-slate-600 mb-2">
                <span className="font-bold text-slate-800">Error Code:</span> {apiError.code}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-800">Status:</span> {apiError.status}
              </p>
            </div>
            <p className="text-slate-500 font-bold mb-6">
              {apiError.message}
            </p>
            <button
              onClick={handleDismissApiError}
              className="w-full py-4 bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-white border-b-4 border-sky-600 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {view === 'LOBBY' ? (
        <LobbyScreen
          topic={topic || (file ? file.name : "Context Content")}
          onStartRaid={(friends) => handleStartGame('COOP', friends)}
          onBack={() => setView('MENU')}
        />
      ) : view === 'COMPETITION_SETUP' ? (
        <CompetitionSetup
          onGameStart={handleCompetitionStart}
          onBack={() => setView('MENU')}
          multiplayer={multiplayer}
        />
      ) : view === 'COMPETITION_GAME' && competitionRoom && gameState ? (
        <CompetitionGameScreen
          roomState={competitionRoom}
          gameState={gameState}
          allTurns={competitionTurns.current}
          onGameEnd={handleCompetitionEnd}
          onBack={() => setView('MENU')}
          multiplayer={multiplayer}
        />
      ) : view === 'MENU' ? (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-lg">

            {/* Logo Area */}
            <div className="text-center mb-6 md:mb-10">
              <div className="inline-block p-4 rounded-3xl bg-sky-400 text-white mb-4 rotate-3 shadow-lg transition-transform hover:rotate-6">
                <Swords className="w-10 h-10 md:w-12 md:h-12" strokeWidth={2.5} />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-800 mb-2">
                Clash of Minds
              </h1>
              <p className="text-slate-500 font-bold text-lg">
                Turn boring notes into a game
              </p>
            </div>

            {/* Menu Buttons Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Classic Mode - Occupies full width on mobile, half on desktop */}
            </div>

            <div className="bg-white rounded-[2rem] border-b-8 border-slate-200 p-6 md:p-8 shadow-xl relative transition-all duration-300 ease-out">
              {/* Menu Button & Expanding Buttons */}
              <div className="absolute top-4 right-4 z-50 flex items-center gap-2 pointer-events-auto">
                {/* Expanding buttons - animate from right (only show when menu open and not in settings/stats) */}
                <div className={`flex gap-2 transition-all duration-300 ease-out ${showMenu && !showSettings && !showStats ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                  <button
                    onClick={() => { soundManager.playButtonClick(); soundManager.toggleSound(); }}
                    disabled={loading}
                    className={`p-2 transition-colors bg-slate-100 rounded-xl disabled:opacity-50 ${soundManager.isSoundEnabled ? 'text-green-500 hover:text-green-600' : 'text-slate-400 hover:text-slate-500'}`}
                  >
                    {soundManager.isSoundEnabled ? <SpeakerWaveIcon className="w-6 h-6" /> : <SpeakerXMarkIcon className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={() => { soundManager.playButtonClick(); setShowQuests(true); setShowSettings(false); setShowMenu(false); }}
                    disabled={loading}
                    className="p-2 transition-colors bg-slate-100 rounded-xl disabled:opacity-50 text-slate-400 hover:text-purple-500"
                  >
                    <FireIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => { soundManager.playButtonClick(); setShowStats(true); setShowSettings(false); setShowMenu(false); }}
                    disabled={loading}
                    className="p-2 transition-colors bg-slate-100 rounded-xl disabled:opacity-50 text-slate-400 hover:text-amber-500"
                  >
                    <TrophyIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => { soundManager.playButtonClick(); setShowSettings(true); setShowStats(false); setShowMenu(false); }}
                    disabled={loading}
                    className="p-2 transition-colors bg-slate-100 rounded-xl disabled:opacity-50 text-slate-400 hover:text-sky-500"
                  >
                    <Cog6ToothIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => { soundManager.playButtonClick(); logout(); }}
                    disabled={loading}
                    className="p-2 transition-colors bg-slate-100 rounded-xl disabled:opacity-50 text-slate-400 hover:text-red-500"
                    title="Sign Out"
                  >
                    <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Menu/Close toggle button */}
                <button
                  onClick={() => {
                    soundManager.playButtonClick();
                    if (showSettings || showStats) {
                      // Close settings/stats and go back to main menu
                      setShowSettings(false);
                      setShowStats(false);
                      setShowMenu(false);
                    } else {
                      // Toggle menu
                      setShowMenu(!showMenu);
                    }
                  }}
                  disabled={loading}
                  className={`p-2 transition-colors bg-slate-100 rounded-xl disabled:opacity-50 ${showMenu || showSettings || showStats ? 'text-sky-500' : 'text-slate-400 hover:text-sky-500'}`}
                >
                  {showSettings || showStats ? (
                    <XMarkIcon className="w-6 h-6" />
                  ) : (
                    <Bars3Icon className="w-6 h-6" />
                  )}
                </button>
              </div>

              {/* Backdrop to close menu */}
              {showMenu && !showSettings && !showStats && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setShowMenu(false)}
                />
              )}

              {!showSettings && !showStats && (
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={() => { soundManager.playButtonClick(); handleOpenLobby(); }}
                    className="flex-1 py-3 bg-purple-500 hover:bg-purple-400 text-white border-b-4 border-purple-700 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                  >
                    <UserGroupIcon className="w-5 h-5" /> Raid
                  </button>
                  <button
                    onClick={() => { soundManager.playButtonClick(); setView('COMPETITION_SETUP'); }}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white border-b-4 border-red-700 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                  >
                    <Swords className="w-5 h-5" /> 1v1 Battle
                  </button>
              {/* Resume Game Modal */}
              {showResumeModal && savedGameData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                  <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fadeIn">
                    <h2 className="text-2xl font-black text-slate-800 mb-4">Continue Your Battle?</h2>
                    <p className="text-slate-600 mb-2">
                      You have a saved game from{' '}
                      <span className="font-bold">
                        {new Date(savedGameData.timestamp).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-slate-500 text-sm mb-6">
                      Topic: <span className="font-bold">{savedGameData.gameState.topic_title || 'Unknown'}</span>
                      {' • '}
                      Turn {savedGameData.gameState.stats.current_turn_index + 1} of {savedGameData.gameState.stats.total_turns}
                      {' • '}
                      HP: {savedGameData.gameState.stats.player_hp}/{savedGameData.gameState.stats.player_max_hp}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleResumeGame}
                        className="flex-1 bg-green-500 hover:bg-green-400 active:bg-green-600 text-white border-b-4 border-green-700 active:border-b-0 active:translate-y-1 rounded-xl py-3 font-bold uppercase tracking-wide transition-all"
                      >
                        Resume
                      </button>
                      <button
                        onClick={handleStartNewGame}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 border-b-4 border-slate-400 active:border-b-0 active:translate-y-1 rounded-xl py-3 font-bold uppercase tracking-wide transition-all"
                      >
                        New Game
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleStartGame(); }} className="space-y-6">

                {showSettings ? (
                  <div className="space-y-6 animate-fadeIn mt-10">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2">Game Settings</h3>

                    {/* Number of Questions Slider */}
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                        <span>Questions</span>
                        <span className="text-sky-600 bg-sky-100 px-2 py-0.5 rounded text-sm">{numQuestions}</span>
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="10"
                        step="1"
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(Number(e.target.value))}
                        className="w-full h-4 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-2">
                        <span>Short (3)</span>
                        <span>Epic (10)</span>
                      </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Questions Difficulty</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map(d => {
                          const colors = {
                            EASY: difficulty === d ? 'bg-green-500 border-green-700 text-white translate-y-1 border-b-0' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200',
                            NORMAL: difficulty === d ? 'bg-orange-500 border-orange-700 text-white translate-y-1 border-b-0' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200',
                            HARD: difficulty === d ? 'bg-red-500 border-red-700 text-white translate-y-1 border-b-0' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                          };
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => { soundManager.playButtonClick(); setDifficulty(d); }}
                              className={`py-3 rounded-xl font-black text-xs md:text-sm border-b-4 transition-all ${colors[d]}`}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Player Customization */}
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Player Customization</label>

                      {/* Gender */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {(['RANDOM', 'MALE', 'FEMALE', 'NON_BINARY'] as Gender[]).map(g => {
                          const getGenderStyle = () => {
                            if (gender !== g) return 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200';
                            switch (g) {
                              case 'RANDOM': return 'bg-slate-500 border-slate-700 text-white translate-y-1 border-b-0';
                              case 'MALE': return 'bg-blue-500 border-blue-700 text-white translate-y-1 border-b-0';
                              case 'FEMALE': return 'bg-pink-500 border-pink-700 text-white translate-y-1 border-b-0';
                              case 'NON_BINARY': return 'bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 border-purple-700 text-white translate-y-1 border-b-0';
                              default: return 'bg-slate-100 border-slate-200 text-slate-600';
                            }
                          };
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => { soundManager.playButtonClick(); setGender(g); }}
                              className={`py-2 rounded-xl font-bold text-xs border-b-4 transition-all ${getGenderStyle()}`}
                            >
                              {g === 'RANDOM' ? 'Random' : g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Non-binary'}
                            </button>
                          );
                        })}
                      </div>

                      {/* Age */}
                      <div className="mb-3">
                        <label className="block text-[10px] font-bold text-slate-400 mb-2">AGE</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="10"
                            max="100"
                            step="1"
                            value={age}
                            onChange={(e) => {
                              if (randomAge) setRandomAge(false);
                              setAge(Number(e.target.value));
                            }}
                            className={`flex-1 h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500 ${randomAge ? 'opacity-40' : ''}`}
                          />
                          <span className={`text-sm font-bold min-w-[3ch] text-right ${randomAge ? 'text-sky-300' : 'text-sky-600'}`}>
                            {randomAge ? '?' : age}
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={randomAge}
                              onChange={(e) => {
                                soundManager.playButtonClick();
                                setRandomAge(e.target.checked);
                                if (e.target.checked) setAge(10);
                              }}
                              className="w-4 h-4 accent-slate-500 rounded"
                            />
                            <span className="text-[10px] font-bold text-slate-400">Random</span>
                          </label>
                        </div>
                      </div>

                      {/* Ethnicity */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">ETHNICITY</label>
                        <select
                          value={ethnicity}
                          onChange={(e) => { setEthnicity(e.target.value); }}
                          className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:border-slate-400 outline-none"
                        >
                          <option value="Random">Random</option>
                          <option value="Asian">Asian</option>
                          <option value="Black">Black</option>
                          <option value="White">White</option>
                          <option value="Hispanic">Hispanic</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { soundManager.playButtonClick(); setShowSettings(false); }}
                      className="w-full py-3 bg-green-500 hover:bg-green-400 text-white border-b-4 border-green-700 rounded-xl font-bold text-sm transition-all active:border-b-0 active:translate-y-1"
                    >
                      Save Settings
                    </button>

                    <p className="text-center text-[10px] text-slate-400 mt-4">
                      Made by <span className="font-bold">Caio Pedroso</span> with Google AI Studio
                    </p>
                  </div>
                ) : showStats ? (
                  <StatsPanel
                    stats={playerStats}
                    onStatsChange={setPlayerStats}
                  />
                ) : (
                  <>
                    {/* Main Input Form */}
                    <div className="animate-fadeIn space-y-6 mt-10">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">What are we learning?</label>

                        {/* Smart Input Container */}
                        <div
                          className={`w-full border-b-4 rounded-2xl px-6 py-4 font-bold text-lg transition-all flex flex-wrap gap-2 items-center
                                    ${file
                              ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                              : 'bg-slate-100 border-slate-200 focus-within:border-sky-400 focus-within:bg-white'
                            }`}
                        >
                          {/* Pasted Content Chip */}
                          {pastedContent && (
                            <div className="bg-sky-100 text-sky-600 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                              <ClipboardDocumentListIcon className="w-4 h-4" />
                              <span>[Pasted {pastedContent.split('\n').length} lines]</span>
                              <button
                                type="button"
                                onClick={handleClearPasted}
                                disabled={loading}
                                className="ml-1 hover:text-sky-800"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={topic}
                            disabled={!!file || loading}
                            onChange={(e) => setTopic(e.target.value)}
                            onPaste={handlePaste}
                            placeholder={file ? "Using File Context..." : pastedContent ? "Add instruction (e.g. 'Make it hard')..." : "Type a topic or paste your notes..."}
                            className={`flex-grow bg-transparent outline-none placeholder-slate-400 text-slate-800 min-w-[50%]`}
                          />
                        </div>
                      </div>

                      <div className="text-center font-black text-slate-300 text-xs tracking-widest uppercase py-2">- OR -</div>

                      {/* File Upload Area */}
                      <div className="relative group">

                        {file ? (
                          <div className={`border-4 rounded-2xl p-6 flex flex-col items-center justify-center transition-all border-sky-400 bg-sky-50`}>
                            <button
                              type="button"
                              onClick={clearFile}
                              disabled={loading}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-20 disabled:opacity-50"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>

                            {file.type.includes('pdf') ? (
                              <DocumentTextIcon className="w-10 h-10 mb-2 text-sky-500" />
                            ) : (
                              <PhotoIcon className="w-10 h-10 mb-2 text-sky-500" />
                            )}

                            <span className="font-black text-sm text-sky-600 uppercase tracking-wide">
                              {file.type.includes('pdf') ? "PDF Loaded!" : "Photo Loaded!"}
                            </span>
                            <span className="text-xs text-sky-400 font-bold mt-1 max-w-[200px] truncate">
                              {file.name}
                            </span>
                          </div>
                        ) : (
                          <div className="relative cursor-pointer">
                            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} disabled={loading} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed" />
                            <div className="border-dashed border-4 rounded-2xl p-6 flex flex-col items-center justify-center transition-all border-slate-200 bg-slate-50 hover:bg-slate-100 group-hover:border-sky-300">
                              <PhotoIcon className="w-10 h-10 mb-2 text-slate-300 group-hover:text-sky-300 transition-colors" />
                              <span className="font-bold text-sm text-slate-400 group-hover:text-sky-400 transition-colors">
                                Upload Photo / PDF
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <button
                        type="submit"
                        disabled={loading || (!topic && !file && !pastedContent)}
                        className="relative w-full bg-green-500 hover:bg-green-400 active:bg-green-600 text-white border-b-8 border-green-700 active:border-b-0 active:translate-y-2 rounded-2xl py-4 font-black text-xl uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg overflow-hidden"
                      >
                        {loading && (
                          <div className="absolute left-6 top-1/2 -translate-y-1/2">
                            <SparklesIcon className="w-6 h-6 animate-spin text-white" />
                          </div>
                        )}

                        <div className="flex flex-col items-center leading-tight">
                          <span className={loading ? "animate-pulse" : ""}>{loading ? "LOADING..." : "START BATTLE"}</span>
                          {loading && (
                            <span className="text-[10px] opacity-90 font-bold mt-0.5 tracking-normal normal-case">
                              this can take a minute, please wait
                            </span>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenLobby}
                        disabled={loading || (!topic && !file && !pastedContent)}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-purple-600 border-b-4 border-slate-300 hover:border-purple-300 active:border-b-0 active:translate-y-2 rounded-2xl py-3 font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <UserGroupIcon className="w-5 h-5" />
                        <span>Start Co-op Raid</span>
                      </button>
                    </div>

                    {/* Loading Progress Bar */}
                    {loading && loadingProgress && (
                      <LoadingProgress progress={loadingProgress} />
                    )}

                    {/* Manual Resume Button (Debug/Fallback) */}
                    {!loading && currentUser && hasSavedGame(currentUser.uid) && (
                      <button
                        onClick={() => {
                          const saved = loadGameState(currentUser.uid);
                          if (saved) {
                            setSavedGameData(saved);
                            setShowResumeModal(true);
                          }
                        }}
                        className="mt-2 w-full bg-blue-500 hover:bg-blue-400 text-white border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 rounded-xl py-2 font-bold text-sm uppercase tracking-wide transition-all"
                      >
                        📂 Resume Saved Game
                      </button>
                    )}

                  </>
                )}

              </form>
            </div>

            <p className="text-center text-xs font-bold text-slate-300 mt-8 uppercase tracking-widest">
              Powered by Google Gemini
            </p>

          </div>
        </div>
      ) : gameState ? (
        <GameScreen
          gameState={gameState}
          bossImage={bossImage}
          playerImage={playerImage}
          backgroundImage={backgroundImage}
          onAction={handleAction}
          onTransitionComplete={handleTransitionComplete}
          onGiveUp={handleReset}
          onSaveAndQuit={handleSaveAndQuit}
          onUsePowerup={handleUsePowerup}
          soundManager={soundManager}
          missedQuestions={[...currentSessionMissedQuestions.current]}
          topicName={gameState.topic_title || 'General Knowledge'}
          contextSummary={gameState.context_summary}
        />
      ) : null
      }
    </div >
  );
};

const AuthWrapper: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return <GameApp />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
};

export default App;