import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, TurnContent, Difficulty, Gender, PlayerStats, LoadingProgress as LoadingProgressType, PreloadedTurn, CompetitionRoomState, Quest } from './types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/components/LoginScreen';
import { initializeGame, generateGameImage, generateDailyQuests } from './services/geminiService';
import { loadStats, recordGameStart, recordTurnResult, recordGameEnd } from './services/statsService';
import { saveGameState, loadGameState, clearSavedGame, hasSavedGame, SavedGameData } from './services/saveService';
import { GameScreen } from './components/GameScreen';
import { StatsPanel } from './components/StatsPanel';
import { LoadingProgress } from './components/LoadingProgress';
import { LobbyScreen } from './components/LobbyScreen';
import { CompetitionSetup } from './components/CompetitionSetup';
import { CompetitionGameScreen } from './components/CompetitionGameScreen';
import { GrimoireModal } from './components/GrimoireModal';
import { saveBattleForOffline, getOfflineBattles, deleteOfflineBattle } from './services/offlineService';
import { OfflineBattlePack } from './types';
import { SparklesIcon, PhotoIcon, Cog6ToothIcon, DocumentTextIcon, XMarkIcon, ClipboardDocumentListIcon, TrophyIcon, Bars3Icon, SpeakerWaveIcon, SpeakerXMarkIcon, UserGroupIcon, ArrowLeftOnRectangleIcon, FireIcon, CheckCircleIcon, BookOpenIcon, WifiIcon, TrashIcon, CloudArrowDownIcon } from '@heroicons/react/24/solid';
import { RaidGameScreen } from './components/RaidGameScreen';

import { Swords } from 'lucide-react';
import { useSoundManager } from './hooks/useSoundManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { KnowledgeProvider, useKnowledge } from './src/context/KnowledgeContext'; // Import Knowledge Context

// Missed Question tracking
interface MissedQuestion {
  question: string;
  correctAnswer: string;
  playerAnswer: string;
  timestamp: number;
}

// Error popup for quota/rate limit errors
interface ApiError {
  code: number;
  status: string;
  message: string;
}

// Daily Question Widget - Interactive single question with graffiti feedback
interface DailyQuestionWidgetProps {
  quest: Quest;
  soundManager: any;
  onComplete: () => void;
}

const DailyQuestionWidget: React.FC<DailyQuestionWidgetProps> = ({ quest, soundManager, onComplete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Pool of interesting questions about tech, web, Python, and current events
  const questionPool = [
    {
      question: "In Python, what keyword is used to create a function?",
      options: ["def", "function", "func", "create"],
      correctAnswer: "def",
      category: "🐍 Python"
    },
    {
      question: "What does HTML stand for?",
      options: ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink Text Making Language"],
      correctAnswer: "HyperText Markup Language",
      category: "🌐 Web Dev"
    },
    {
      question: "Which CSS property is used to change text color?",
      options: ["color", "text-color", "font-color", "foreground"],
      correctAnswer: "color",
      category: "🎨 CSS"
    },
    {
      question: "What is the output of: print(type([]))?",
      options: ["<class 'list'>", "<class 'array'>", "<class 'tuple'>", "<class 'dict'>"],
      correctAnswer: "<class 'list'>",
      category: "🐍 Python"
    },
    {
      question: "Which company developed React.js?",
      options: ["Facebook (Meta)", "Google", "Microsoft", "Amazon"],
      correctAnswer: "Facebook (Meta)",
      category: "⚛️ React"
    },
    {
      question: "What does API stand for?",
      options: ["Application Programming Interface", "Advanced Program Integration", "Automatic Protocol Interface", "App Process Input"],
      correctAnswer: "Application Programming Interface",
      category: "💻 Tech"
    },
    {
      question: "In JavaScript, which method adds an item to the end of an array?",
      options: ["push()", "append()", "add()", "insert()"],
      correctAnswer: "push()",
      category: "📜 JavaScript"
    },
    {
      question: "What is the shortcut for 'Undo' on most computers?",
      options: ["Ctrl+Z / Cmd+Z", "Ctrl+U / Cmd+U", "Ctrl+Y / Cmd+Y", "Ctrl+X / Cmd+X"],
      correctAnswer: "Ctrl+Z / Cmd+Z",
      category: "⌨️ Shortcuts"
    },
    {
      question: "Which Python library is most popular for data analysis?",
      options: ["Pandas", "Django", "Flask", "Tkinter"],
      correctAnswer: "Pandas",
      category: "📊 Data Science"
    },
    {
      question: "What does 'AI' stand for in tech?",
      options: ["Artificial Intelligence", "Automated Integration", "Advanced Interface", "Application Index"],
      correctAnswer: "Artificial Intelligence",
      category: "🤖 AI"
    },
    {
      question: "Which tag is used for the largest heading in HTML?",
      options: ["<h1>", "<heading>", "<head>", "<h6>"],
      correctAnswer: "<h1>",
      category: "🌐 HTML"
    },
    {
      question: "What is Git primarily used for?",
      options: ["Version Control", "Database Management", "Web Hosting", "Code Compilation"],
      correctAnswer: "Version Control",
      category: "📦 Git"
    }
  ];

  // Pick question based on day of year for consistency
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyQuestion = questionPool[dayOfYear % questionPool.length];

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    const correct = answer === dailyQuestion.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      soundManager.playCorrectAnswer();
      onComplete();
    } else {
      soundManager.playWrongAnswer();
    }
  };

  const resetWidget = () => {
    setIsExpanded(false);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  if (showResult) {
    return (
      <div className={`mb-6 rounded-2xl p-6 border-4 shadow-2xl animate-fadeIn overflow-hidden relative ${isCorrect
        ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-300'
        : 'bg-gradient-to-br from-red-400 to-rose-500 border-red-300'
        }`}>
        {/* Graffiti-style result */}
        <div className="text-center relative z-10">
          {isCorrect ? (
            <>
              <div className="text-6xl mb-2 animate-bounce">🎉</div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tight"
                style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.3), -1px -1px 0 rgba(255,255,255,0.5)' }}>
                WELL DONE!
              </h2>
              <p className="text-white/90 font-bold mt-2">You nailed it! 🔥</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-2">😅</div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight"
                style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}>
                Nice Try!
              </h2>
              <div className="mt-3 bg-white/20 backdrop-blur rounded-xl p-3">
                <p className="text-white/80 text-sm font-bold">Correct Answer:</p>
                <p className="text-white text-xl font-black">{dailyQuestion.correctAnswer}</p>
              </div>
            </>
          )}
          <button
            onClick={resetWidget}
            className="mt-4 px-6 py-2 bg-white/30 hover:bg-white/50 rounded-full text-white font-bold text-sm uppercase transition-all"
          >
            Got it!
          </button>
        </div>

        {/* Background decorations */}
        <div className="absolute top-2 right-2 text-6xl opacity-20 rotate-12">⭐</div>
        <div className="absolute bottom-2 left-2 text-4xl opacity-20 -rotate-12">✨</div>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200 shadow-lg animate-fadeIn overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        onClick={() => { soundManager.playButtonClick(); setIsExpanded(!isExpanded); }}
        className="w-full p-4 flex items-center justify-between hover:bg-indigo-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <FireIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-indigo-800 uppercase tracking-wide">Daily Challenge</h3>
              <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{dailyQuestion.category}</span>
            </div>
            <p className="text-xs text-indigo-500 font-medium">Tap to test your knowledge!</p>
          </div>
        </div>
        <div className={`text-2xl transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ⬇️
        </div>
      </button>

      {/* Expanded question and options */}
      {isExpanded && (
        <div className="p-4 pt-0 animate-fadeIn">
          <div className="bg-white rounded-xl p-4 border-2 border-indigo-100 mb-3">
            <p className="text-lg font-bold text-slate-800 text-center">
              {dailyQuestion.question}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {dailyQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(option)}
                className="p-3 bg-white hover:bg-indigo-50 border-2 border-indigo-100 hover:border-indigo-300 rounded-xl font-bold text-sm text-slate-700 transition-all active:scale-95"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const GameApp: React.FC = () => {
  // Hooks must run unconditionally
  const { logout, currentUser } = useAuth();
  const { shards, addShard } = useKnowledge(); // Use Knowledge Context
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [useGhosts, setUseGhosts] = useState(false); // Ghosts of Battles Past Toggle
  const [showGrimoire, setShowGrimoire] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar toggle state
  const [gameMode, setGameMode] = useState<'SOLO' | 'RAID' | 'PVP'>('SOLO');
  const [view, setView] = useState<'MENU' | 'GAME' | 'LOBBY' | 'COMPETITION_SETUP' | 'RAID_SETUP' | 'COMPETITION_GAME' | 'RAID_GAME' | 'OFFLINE_MENU'>('MENU');
  const [offlineBattles, setOfflineBattles] = useState<OfflineBattlePack[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);
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
  const handleStartGame = async (mode: 'SOLO' | 'COOP' | 'RAID' = 'SOLO', friends: string[] = []) => {
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

    // Step 1: Initialize Game Logic with AI
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
        manifest = await initializeGame({
          topic: finalTopic || undefined,
          fileBase64,
          mimeType,
          difficulty,
          numQuestions,
          gender,
          age: randomAge ? 'Random' : String(age),
          ethnicity,
          mode,
          players: friends,
          knowledgeShards: useGhosts ? shards : [] // Pass shards if enabled
        });
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

      if (gameMode === 'RAID') {
        setView('RAID_GAME');
      } else {
        setView('COMPETITION_GAME');
      }
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
    const currentTurn = gameState.current_turn;

    if (isCorrect) {
      newBossHp = 0;
      if (nextIndex >= gameState.stats.total_turns) {
        newStatus = GameStatus.WON;
      }
      // Update Quests - TOTAL_CORRECT & TOPIC
      updateQuestProgress('TOTAL_CORRECT', 1);
      updateQuestProgress('TOPIC_ACCURACY', 1, currentTopicName.current);
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

      // Record missed question as a knowledge shard
      if (currentUser && currentTurn.question && answer) {
        addShard({
          question: currentTurn.question,
          correctAnswer: currentTurn.correct_answer || "Unknown",
          playerAnswer: answer,
          timestamp: Date.now()
        });
      }
    }

    // Track turn result
    const newStreak = isCorrect ? gameState.stats.streak + 1 : 0;

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
          topic={topic || ""}
          isLoading={loading}
          onStartRaid={(friends) => handleStartGame('RAID', friends)}
          onBack={() => setView('MENU')}
        />
      ) : view === 'COMPETITION_SETUP' ? (
        <CompetitionSetup
          onGameStart={handleCompetitionStart}
          onBack={() => setView('MENU')}
          multiplayer={multiplayer}
          isLoading={loading}
        />
      ) : view === 'RAID_SETUP' ? (
        <CompetitionSetup
          onGameStart={handleCompetitionStart}
          onBack={() => setView('MENU')}
          multiplayer={multiplayer}
          isRaid={true}
          isLoading={loading}
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
      ) : view === 'RAID_GAME' && competitionRoom && gameState ? (
        <RaidGameScreen
          roomState={competitionRoom}
          gameState={gameState}
          allTurns={competitionTurns.current}
          onGameEnd={handleCompetitionEnd}
          onBack={() => setView('MENU')}
          multiplayer={multiplayer}
        />
      ) : view === 'OFFLINE_MENU' ? (
        <div className="min-h-screen p-4 flex items-center justify-center">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-2xl w-full border-b-8 border-slate-200 relative">
            <button onClick={() => setView('MENU')} className="absolute top-6 left-6 p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><ArrowLeftOnRectangleIcon className="w-6 h-6 rotate-180" /></button>

            <div className="text-center mb-8">
              <div className="inline-block p-4 rounded-3xl bg-slate-800 text-white mb-4 shadow-lg">
                <WifiIcon className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Offline Mode</h2>
              <p className="text-slate-500 font-bold">Play pre-generated battles without internet</p>
            </div>

            <div className="space-y-6">
              {/* Preload New Battle */}
              <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100">
                <h3 className="font-black text-indigo-900 mb-2 flex items-center gap-2">
                  <CloudArrowDownIcon className="w-5 h-5" />
                  Download New Battle
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="offline-topic"
                    placeholder="Enter Topic (e.g. Space, Python)..."
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-indigo-200 font-bold text-indigo-900 focus:border-indigo-500 outline-none"
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById('offline-topic') as HTMLInputElement;
                      if (!input.value) return;
                      setIsPreloading(true);
                      try {
                        await saveBattleForOffline({
                          topic: input.value,
                          numQuestions: 5,
                          difficulty: 'NORMAL',
                          gender: 'RANDOM',
                          age: 'Random',
                          ethnicity: 'Random',
                          mode: 'SOLO'
                        });
                        setOfflineBattles(getOfflineBattles());
                        input.value = '';
                        soundManager.playVictory();
                      } catch (e) {
                        alert("Failed to download: " + e);
                      }
                      setIsPreloading(false);
                    }}
                    disabled={isPreloading}
                    className="px-6 py-3 bg-indigo-500 text-white font-black rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-all"
                  >
                    {isPreloading ? 'Downloading...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Saved Battles List */}
              <div>
                <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs mb-3">Saved Battles</h3>
                {offlineBattles.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 font-bold italic">No offline battles saved yet.</p>
                ) : (
                  <div className="grid gap-3">
                    {offlineBattles.map(battle => (
                      <div key={battle.id} className="bg-white border-2 border-slate-200 p-4 rounded-xl flex justify-between items-center hover:border-indigo-400 transition-colors group shadow-sm">
                        <div>
                          <p className="font-black text-slate-700 text-lg">{battle.topic}</p>
                          <p className="text-xs font-bold text-slate-400">
                            {new Date(battle.timestamp).toLocaleDateString()} • {battle.difficulty}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              soundManager.playBattleMusic();
                              // Load Manifest directly into Game State
                              setGameState({
                                game_status: GameStatus.PLAYING,
                                topic_title: battle.topic,
                                theme: battle.manifest.gameState.theme,
                                stats: {
                                  current_turn_index: 0,
                                  total_turns: battle.manifest.allTurns.length,
                                  player_hp: 100,
                                  player_max_hp: 100,
                                  streak: 0,
                                  turns_won: 0,
                                  turns_lost: 0,
                                  mana: 50,
                                  max_mana: 100,
                                  active_powerups: []
                                },
                                current_turn: battle.manifest.allTurns[0]
                              });
                              // Populate preloadedTurns from pack
                              preloadedTurns.current = battle.manifest.allTurns.map((turn, i) => ({
                                content: turn,
                                bossImage: null
                              }));

                              // Set Images
                              setPlayerImage(null);
                              setBackgroundImage(null);
                              setBossImage(null);

                              setView('GAME');
                            }}
                            className="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 shadow-md active:translate-y-1 transition-all"
                          >
                            Play
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this battle?")) {
                                deleteOfflineBattle(battle.id);
                                setOfflineBattles(getOfflineBattles());
                              }
                            }}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : view === 'MENU' ? (
        <div className="relative flex items-start justify-center min-h-screen p-4 overflow-hidden pt-[40vh]">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src="/background.png"
              alt="Background"
              className="w-full h-full object-cover opacity-100"
            />
          </div>

          <div className="relative z-10 w-full max-w-lg">

            {/* Menu Buttons Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Classic Mode - Occupies full width on mobile, half on desktop */}
            </div>

            <div className="bg-white rounded-[2rem] border-b-8 border-slate-200 p-6 md:p-8 shadow-xl relative transition-all duration-300 ease-out">
              {/* FIXED SIDEBAR - TOP RIGHT TOGGLEABLE */}

              {/* Toggle Button */}
              <button
                onClick={() => { soundManager.playButtonClick(); setIsSidebarOpen(!isSidebarOpen); }}
                className={`fixed top-4 right-4 z-[60] p-3 rounded-xl shadow-lg border-b-4 transition-all active:scale-95 active:border-b-0 active:translate-y-1 bg-white text-slate-700 border-slate-200 hover:text-indigo-600`}
              >
                {isSidebarOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
              </button>

              {/* Sidebar Content */}
              <div className={`fixed top-20 right-4 z-50 flex flex-col gap-3 transition-all duration-300 origin-top-right ${isSidebarOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
                {/* Sound Toggle */}
                <button
                  onClick={() => { soundManager.playButtonClick(); soundManager.toggleSound(); }}
                  className="group relative flex items-center justify-end"
                >
                  <span className="absolute right-14 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {soundManager.isSoundEnabled ? 'Mute Sound' : 'Enable Sound'}
                  </span>
                  <div className={`p-3 rounded-xl shadow-lg border-b-4 transition-all active:scale-95 active:border-b-0 active:translate-y-1 ${soundManager.isSoundEnabled ? 'bg-white text-green-500 border-slate-200 hover:text-green-600' : 'bg-slate-100 text-slate-400 border-slate-300'}`}>
                    {soundManager.isSoundEnabled ? <SpeakerWaveIcon className="w-6 h-6" /> : <SpeakerXMarkIcon className="w-6 h-6" />}
                  </div>
                </button>

                <div className="h-px w-8 bg-slate-300 mx-auto my-1" />

                {/* Quests */}
                <button
                  onClick={() => { soundManager.playButtonClick(); setShowQuests(true); setShowSettings(false); setShowMenu(false); setIsSidebarOpen(false); }}
                  className="group relative flex flex-col items-center"
                >
                  <div className="p-3 bg-white hover:bg-purple-50 text-slate-400 hover:text-purple-500 rounded-xl shadow-lg border-b-4 border-slate-200 hover:border-purple-200 transition-all active:scale-95 active:border-b-0 active:translate-y-1">
                    <FireIcon className="w-6 h-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-black uppercase text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm">Quests</span>
                </button>

                {/* Grimoire */}
                <button
                  onClick={() => { soundManager.playButtonClick(); setShowGrimoire(true); setShowSettings(false); setShowMenu(false); setIsSidebarOpen(false); }}
                  className="group relative flex flex-col items-center"
                >
                  <div className="p-3 bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 rounded-xl shadow-lg border-b-4 border-slate-200 hover:border-indigo-200 transition-all active:scale-95 active:border-b-0 active:translate-y-1">
                    <BookOpenIcon className="w-6 h-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-black uppercase text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm">Grimoire</span>
                </button>

                {/* Offline */}
                <button
                  onClick={() => {
                    soundManager.playButtonClick();
                    setOfflineBattles(getOfflineBattles());
                    setView('OFFLINE_MENU');
                    setIsSidebarOpen(false);
                  }}
                  className="group relative flex flex-col items-center"
                >
                  <div className="p-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl shadow-lg border-b-4 border-slate-200 hover:border-slate-300 transition-all active:scale-95 active:border-b-0 active:translate-y-1">
                    <WifiIcon className="w-6 h-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-black uppercase text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm">Offline</span>
                </button>

                {/* Stats */}
                <button
                  onClick={() => { soundManager.playButtonClick(); setShowStats(true); setShowSettings(false); setIsSidebarOpen(false); }}
                  className="group relative flex flex-col items-center"
                >
                  <div className="p-3 bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-500 rounded-xl shadow-lg border-b-4 border-slate-200 hover:border-amber-200 transition-all active:scale-95 active:border-b-0 active:translate-y-1">
                    <TrophyIcon className="w-6 h-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-black uppercase text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm">Stats</span>
                </button>

                <div className="h-px w-8 bg-slate-300 mx-auto my-1" />

                {/* Settings */}
                <button
                  onClick={() => { soundManager.playButtonClick(); setShowSettings(true); setShowStats(false); setIsSidebarOpen(false); }}
                  className="group relative flex flex-col items-center"
                >
                  <div className="p-3 bg-white hover:bg-sky-50 text-slate-400 hover:text-sky-500 rounded-xl shadow-lg border-b-4 border-slate-200 hover:border-sky-200 transition-all active:scale-95 active:border-b-0 active:translate-y-1">
                    <Cog6ToothIcon className="w-6 h-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-black uppercase text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm">Settings</span>
                </button>

                {/* Logout */}
                <button
                  onClick={() => { soundManager.playButtonClick(); logout(); }}
                  className="group relative flex flex-col items-center"
                >
                  <div className="p-3 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl shadow-lg border-b-4 border-slate-200 hover:border-red-200 transition-all active:scale-95 active:border-b-0 active:translate-y-1">
                    <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                  </div>
                  <span className="mt-1 text-[10px] font-black uppercase text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm">Sign Out</span>
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
                    onClick={() => { soundManager.playButtonClick(); setGameMode('RAID'); setView('RAID_SETUP'); }}
                    className="flex-1 py-3 bg-purple-500 hover:bg-purple-400 text-white border-b-4 border-purple-700 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                  >
                    <UserGroupIcon className="w-5 h-5" /> Raid
                  </button>
                  <button
                    onClick={() => { soundManager.playButtonClick(); setGameMode('PVP'); setView('COMPETITION_SETUP'); }}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white border-b-4 border-red-700 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                  >
                    <Swords className="w-5 h-5" /> 1v1 Battle
                  </button>
                </div>
              )}
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

              {/* Grimoire Modal */}
              {showGrimoire && (
                <GrimoireModal onClose={() => setShowGrimoire(false)} />
              )}

              {/* Daily Challenge - Single Question */}
              {!showSettings && !showStats && quests.length > 0 && (
                <DailyQuestionWidget
                  quest={quests[0]}
                  soundManager={soundManager}
                  onComplete={() => {
                    updateQuestProgress('TOTAL_CORRECT', 1);
                  }}
                />
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

                      {/* Ghosts of Battles Past Toggle */}
                      <div className="flex items-center justify-between mt-4 p-3 bg-slate-100 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2">
                          <BookOpenIcon className="w-5 h-5 text-slate-500" />
                          <label htmlFor="useGhosts" className="text-sm font-bold text-slate-700 cursor-pointer">
                            Ghosts of Battles Past
                          </label>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="useGhosts"
                            className="sr-only peer"
                            checked={useGhosts}
                            onChange={(e) => {
                              soundManager.playButtonClick();
                              setUseGhosts(e.target.checked);
                            }}
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 px-1">
                        {useGhosts ? `AI will use your ${shards.length} past missed questions to generate new ones.` : 'AI will not use your past missed questions.'}
                      </p>
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

                      {/* Compact Upload & OR */}
                      <div className="flex items-center gap-3">
                        <div className="font-black text-slate-300 text-xs tracking-widest uppercase whitespace-nowrap">- OR -</div>

                        <label className="flex-1 cursor-pointer group">
                          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} disabled={loading} className="hidden" />
                          <div className={`
                                flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed transition-all
                                ${file
                              ? 'bg-sky-50 border-sky-300 text-sky-600 shadow-md'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-sky-300 hover:text-sky-500 hover:bg-white'}
                            `}>
                            {file ? (
                              <>
                                {file.type.includes('pdf') ? <DocumentTextIcon className="w-5 h-5" /> : <PhotoIcon className="w-5 h-5" />}
                                <span className="font-bold text-xs truncate max-w-[100px]">{file.name}</span>
                                <button onClick={(e) => { e.preventDefault(); clearFile(); }} className="p-1 hover:bg-sky-200 rounded-full"><XMarkIcon className="w-3 h-3" /></button>
                              </>
                            ) : (
                              <>
                                <PhotoIcon className="w-5 h-5" />
                                <span className="font-bold text-xs uppercase tracking-wide">Upload Photo/PDF</span>
                              </>
                            )}
                          </div>
                        </label>
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

                    {/* Main Input Form */}

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

      {/* Global Loading Overlay */}
      {loading && loadingProgress && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-scaleUp">
            <div className="mb-4 text-center">
              <SparklesIcon className="w-12 h-12 text-indigo-500 mx-auto animate-spin" />
              <h2 className="text-xl font-black text-slate-800 mt-4 uppercase tracking-widest">Generating Game</h2>
            </div>
            <LoadingProgress progress={loadingProgress} />
          </div>
        </div>
      )}
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center bg-slate-900 min-h-screen flex flex-col items-center justify-center text-white">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong.</h1>
          <p className="mb-6 text-slate-300 max-w-md bg-slate-800 p-4 rounded-xl border border-slate-700">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
          >
            Reload Game
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <KnowledgeProvider>
          <AuthWrapper />
        </KnowledgeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;