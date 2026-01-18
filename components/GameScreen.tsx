import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, GameStatus, MissedQuestion } from '../types';
import { ProgressBar } from './ProgressBar';
import { TransparentImage } from './TransparentImage';
import { StarIcon, XMarkIcon, CheckIcon, SparklesIcon, SpeakerWaveIcon, MicrophoneIcon, LightBulbIcon, BookOpenIcon, FireIcon, ClipboardDocumentListIcon, BoltIcon, ShieldCheckIcon, FaceFrownIcon } from '@heroicons/react/24/solid';
import { Brain, Scroll } from 'lucide-react';
import { useSoundManager } from '../hooks/useSoundManager';
import { ScholarReport } from './ScholarReport';
import { generateMnemonic, speakLikeBoss, getWisdom } from '../services/geminiService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface GameScreenProps {
  gameState: GameState;
  bossImage: string | null;
  playerImage: string | null;
  backgroundImage: string | null;
  onAction: (answer: string, isCorrect: boolean) => void;
  onTransitionComplete: () => void;
  onGiveUp: () => void;
  onSaveAndQuit?: () => void;
  onUsePowerup?: (type: 'SHIELD') => void;
  soundManager: ReturnType<typeof useSoundManager>;
  missedQuestions: MissedQuestion[];
  topicName: string;
  contextSummary?: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  bossImage,
  playerImage,
  backgroundImage,
  onAction,
  onTransitionComplete,
  onGiveUp,
  missedQuestions,
  topicName,
  contextSummary,
  onSaveAndQuit,
  onUsePowerup,
  soundManager
}) => {
  const [input, setInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [waitingForTurn, setWaitingForTurn] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showEnemy, setShowEnemy] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [enemyDefeated, setEnemyDefeated] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [wasWrong, setWasWrong] = useState(false);
  const [shakeWrong, setShakeWrong] = useState(false);
  const [attackingPlayer, setAttackingPlayer] = useState(false);
  const [attackingEnemy, setAttackingEnemy] = useState(false);
  const [playerShaking, setPlayerShaking] = useState(false);
  const [enemyShaking, setEnemyShaking] = useState(false);
  const [enemyFlyingAway, setEnemyFlyingAway] = useState(false);
  const [dismissButtonText] = useState(() => ['Got it!', 'Understood', 'OK'][Math.floor(Math.random() * 3)]);
  const [typewriterText, setTypewriterText] = useState('');
  const [typewriterComplete, setTypewriterComplete] = useState(false);
  // Store the displayed boss name separately to sync with animation timing
  const [displayedBossName, setDisplayedBossName] = useState(gameState.current_turn.new_boss_name || gameState.theme.boss_name);
  // Scholar's Report state
  const [showScholarReport, setShowScholarReport] = useState(false);

  // Refs for dynamic movement calculation
  const playerRef = useRef<HTMLDivElement>(null);
  const enemyRef = useRef<HTMLDivElement>(null);
  const [attackDistance, setAttackDistance] = useState<number>(0);

  // Mnemonic Forge State
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [isForgingMnemonic, setIsForgingMnemonic] = useState(false);

  // Wisdom Scroll State
  const [isFetchingWisdom, setIsFetchingWisdom] = useState(false);
  const [showWisdomModal, setShowWisdomModal] = useState(false);
  const [wisdomHint, setWisdomHint] = useState<string | null>(null);

  // Oracle Mode State
  const [oracleModeEnabled, setOracleModeEnabled] = useState(false);
  const { isListening, transcript, startListening, stopListening, hasSupport } = useSpeechRecognition();

  // Oracle Narration
  useEffect(() => {
    if (oracleModeEnabled && showQuestion && gameState.current_turn.question && !waitingForTurn) {
      // Short delay to allow UI to settle
      const t = setTimeout(() => {
        speakLikeBoss(gameState.current_turn.question);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [oracleModeEnabled, showQuestion, gameState.current_turn.question, waitingForTurn]);

  // Voice Command Matching
  useEffect(() => {
    if (!transcript || !isListening || isProcessing) return;
    const clean = transcript.toLowerCase().trim();
    if (!clean) return;

    console.log("Voice Input:", clean);

    // Helper to trigger action
    const trigger = (ans: string) => {
      handleAction(ans);
      stopListening();
    };

    // Check Options
    const options = gameState.current_turn.options || [];
    // 1. Direct match
    const directMatch = options.find(o => clean.includes(o.toLowerCase()));
    if (directMatch) { trigger(directMatch); return; }

    // 2. "Option A/B/C" logic
    if (gameState.current_turn.challenge_type === 'MULTIPLE_CHOICE' && options.length > 0) {
      const labels = ['a', 'b', 'c', 'd'];
      // Matches "Option A", "Option B", or just "A", "B" (case insensitive due to clean)
      const match = clean.match(/^(?:option\s+)?([a-d])$/);
      if (match) {
        const idx = labels.indexOf(match[1]);
        if (idx !== -1 && idx < options.length) {
          trigger(options[idx]);
          return;
        }
      }
    }

    // 3. True/False
    if (gameState.current_turn.challenge_type === 'TRUE_FALSE') {
      if (clean.includes('true')) trigger('TRUE');
      else if (clean.includes('false')) trigger('FALSE');
    }

  }, [transcript, isListening, gameState.current_turn, isProcessing]);

  // Track all active timeouts so we can clear them on unmount
  const activeTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Helper to create tracked timeouts
  const safeTimeout = (callback: () => void, delay: number) => {
    const id = setTimeout(() => {
      // Remove from tracking array when executed
      activeTimeouts.current = activeTimeouts.current.filter(t => t !== id);
      callback();
    }, delay);
    activeTimeouts.current.push(id);
    return id;
  };

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      activeTimeouts.current.forEach(id => clearTimeout(id));
      activeTimeouts.current = [];
    };
  }, []);

  // When turn content changes, reset waitingForTurn to trigger animations
  useEffect(() => {
    console.log("Turn changed - question:", gameState.current_turn.question?.substring(0, 30));
    setWaitingForTurn(false);
  }, [gameState.current_turn.turn_number, gameState.current_turn.question]);

  // Reset and animate on new turn - show content even without images
  useEffect(() => {
    console.log("Reset effect - waitingForTurn:", waitingForTurn, "turn_index:", gameState.stats.current_turn_index);
    if (!waitingForTurn) {
      console.log("Resetting UI for new turn");
      setShowNarrative(false);
      setShowPlayer(false);
      setShowEnemy(false);
      setShowQuestion(false);
      setShowAnswers(false);
      setEnemyDefeated(false);
      setShowExplanation(false);
      setWasWrong(false);
      setShakeWrong(false);
      setAttackingPlayer(false);
      setAttackingEnemy(false);
      setPlayerShaking(false);
      setEnemyShaking(false);
      setEnemyFlyingAway(false);
      setAttackDistance(0);

      // Reset typewriter
      setTypewriterText('');
      setTypewriterComplete(false);

      // Staggered reveal: narrative (typewriter) -> wait -> player -> enemy -> question -> answers
      const isFirstTurn = gameState.stats.current_turn_index === 0;

      const t1 = setTimeout(() => {
        setShowNarrative(true);
        // Narrative appear sound? Maybe redundant with typewriter, skipping for cleaner audio
      }, 300);

      return () => {
        clearTimeout(t1);
      };
    }
  }, [gameState.current_turn.turn_number, gameState.current_turn.question, waitingForTurn, gameState.stats.current_turn_index]);

  // Typewriter effect for narrative
  useEffect(() => {
    if (!showNarrative || !gameState.current_turn.narrative_setup) return;

    const text = gameState.current_turn.narrative_setup;
    let index = 0;
    setTypewriterText('');
    setTypewriterComplete(false);

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setTypewriterText(text.substring(0, index + 1));
        index++;
      } else {
        clearInterval(typeInterval);
        setTypewriterComplete(true);
      }
    }, 35); // Speed of typewriter

    return () => clearInterval(typeInterval);
  }, [showNarrative, gameState.current_turn.narrative_setup]);

  // After typewriter completes, show the rest of the elements
  useEffect(() => {
    if (!typewriterComplete) return;

    const isFirstTurn = gameState.stats.current_turn_index === 0;
    const baseDelay = 400; // Delay after typewriter finishes

    const t2 = setTimeout(() => {
      setShowPlayer(true);
      if (isFirstTurn) soundManager.playAppearCharacter(); // Play sound when player appears first time
    }, isFirstTurn ? baseDelay : 0);

    const t3 = setTimeout(() => {
      setShowEnemy(true);
      soundManager.playAppearCharacter(); // Play sound for enemy appear (every turn usually, or when changing)
      // Update displayed boss name when enemy appears (synced with animation)
      setDisplayedBossName(gameState.current_turn.new_boss_name || gameState.theme.boss_name);
    }, isFirstTurn ? baseDelay + 600 : baseDelay + 400);

    const t4 = setTimeout(() => {
      setShowQuestion(true);
      soundManager.playAppearUI(); // Play sound for question appear
    }, isFirstTurn ? baseDelay + 1200 : baseDelay + 800);

    const t5 = setTimeout(() => {
      setShowAnswers(true);
      // No extra sound for answers to avoid clutter
    }, isFirstTurn ? baseDelay + 1800 : baseDelay + 1200);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [typewriterComplete, gameState.stats.current_turn_index, soundManager]);

  // End game sound effects
  useEffect(() => {
    if (gameState.game_status === GameStatus.WON) {
      soundManager.playVictory();
    } else if (gameState.game_status === GameStatus.LOST) {
      soundManager.playDefeat();
    }
  }, [gameState.game_status, soundManager]);

  const handleWisdomScroll = async () => {
    soundManager.playButtonClick();
    if (wisdomHint) {
      setShowWisdomModal(true);
      return;
    }

    setIsFetchingWisdom(true);
    try {
      const hint = await getWisdom(gameState.current_turn.question, contextSummary);
      setWisdomHint(hint);
      setShowWisdomModal(true);
    } catch (e) {
      console.error("Wisdom Error", e);
    } finally {
      setIsFetchingWisdom(false);
    }
  };

  const handleAction = async (answer: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setSelectedOption(answer);

    let isCorrect = false;
    if (gameState.current_turn.challenge_type === 'TEXT_INPUT') {
      isCorrect = answer.length > 1;
    } else if (gameState.current_turn.challenge_type === 'TRUE_FALSE') {
      const normalizedAnswer = answer.toUpperCase();
      const normalizedCorrect = (gameState.current_turn.correct_answer || '').toUpperCase();
      isCorrect = normalizedAnswer === normalizedCorrect ||
        (normalizedCorrect.includes('TRUE') && normalizedAnswer === 'TRUE') ||
        (normalizedCorrect.includes('FALSE') && normalizedAnswer === 'FALSE');
    } else {
      isCorrect = answer === gameState.current_turn.correct_answer;
    }

    if (isCorrect) {
      // Play correct answer sound immediately
      soundManager.playCorrectAnswer();
      // Hold green feedback for 1.5s before starting attack animation
      safeTimeout(() => {

        // Calculate dynamic attack distance for Player -> Enemy
        if (playerRef.current && enemyRef.current) {
          const pRect = playerRef.current.getBoundingClientRect();
          const eRect = enemyRef.current.getBoundingClientRect();
          // Move Player to Enemy: Gap + Overlap
          // Distance = (Enemy Left + Enemy Width * 0.2) - Player Right
          // This makes the player hit "into" the enemy slightly
          const dist = (eRect.left + (eRect.width * 0.2)) - pRect.right;
          // Add some overlap for impact feel
          setAttackDistance(dist + (pRect.width * 0.4));
        }

        // Player attacks enemy - FIRST player moves, THEN enemy reacts and vanishes
        setAttackingPlayer(true);
        soundManager.playPlayerAttack();
        safeTimeout(() => {
          setAttackingPlayer(false); // Player returns
          setEnemyShaking(true); // Enemy gets hit after player reaches
          soundManager.playEnemyDamage();
        }, 800);
        safeTimeout(() => {
          setEnemyShaking(false);
          setEnemyDefeated(true); // NOW enemy vanishes after being hit
        }, 1400);
        safeTimeout(() => {
          // Hide question content immediately when transitioning
          setShowQuestion(false);
          setShowAnswers(false);
          // Only NOW call onAction to update game state AFTER animation completes
          onAction(answer, isCorrect);
          setIsProcessing(false);
          setSelectedOption(null);
          setInput('');
          // All turns are pre-loaded, so immediately transition to next turn
          onTransitionComplete();
        }, 2400);
      }, 1500); // 1.5s delay to show green feedback
    } else {
      // Wrong answer - enemy attacks player with full animation sequence
      soundManager.playWrongAnswer();
      setWasWrong(true);
      setShakeWrong(true);
      safeTimeout(() => setShakeWrong(false), 600);

      // Hold red feedback for 1.5s before starting attack animation (same as correct answer)
      safeTimeout(() => {

        // Calculate dynamic attack distance for Enemy -> Player
        if (playerRef.current && enemyRef.current) {
          const pRect = playerRef.current.getBoundingClientRect();
          const eRect = enemyRef.current.getBoundingClientRect();
          // Move Enemy to Player (Negative X)
          // Gap = Player Right - Enemy Left (Negative value)
          // Target: Player Right - Overlap
          const overlap = eRect.width * 0.4;
          // Distance = (Player Right - Overlap) - Enemy Left
          const dist = (pRect.right - overlap) - eRect.left;
          setAttackDistance(dist);
        }

        // Enemy attacks player - FIRST enemy moves, THEN player reacts
        setAttackingEnemy(true);
        soundManager.playEnemyAttack();
        safeTimeout(() => {
          setAttackingEnemy(false); // Enemy returns
          setPlayerShaking(true); // Player gets hit after enemy reaches
          soundManager.playPlayerDamage();
          // Call onAction NOW to update game state (HP, stats) when hit lands
          onAction(answer, false);
          // DON'T call onTransitionComplete here - wait until enemy flies away
        }, 800);
        safeTimeout(() => {
          setPlayerShaking(false);
          // Enemy flies away after hitting player
          setEnemyFlyingAway(true);
        }, 1400);
        // Show explanation after battle animation completes
        safeTimeout(() => {
          forgeMnemonic(answer);
          setShowExplanation(true);
        }, 2400);
      }, 1500); // 1.5s delay to show red feedback (matches correct answer timing)
    }
  };

  const dismissExplanation = () => {
    // Reset all visual states
    setShowExplanation(false);
    setShowQuestion(false);
    setShowAnswers(false);
    setIsProcessing(false);
    setSelectedOption(null);
    setInput('');
    setWasWrong(false);
    setEnemyDefeated(false);
    setShakeWrong(false);
    setAttackingPlayer(false);
    setAttackingEnemy(false);
    setPlayerShaking(false);
    setEnemyShaking(false);
    setEnemyFlyingAway(false);
    setAttackDistance(0);
    // Now load the next turn (boss image was not changed during wrong answer animation)
    onTransitionComplete();
  };

  const renderAnswers = () => {
    const { challenge_type, options } = gameState.current_turn;

    if (challenge_type === 'MULTIPLE_CHOICE' || challenge_type === 'TRUE_FALSE') {
      const displayOptions = challenge_type === 'TRUE_FALSE' ? ['TRUE', 'FALSE'] : options || [];
      const isTrueFalse = challenge_type === 'TRUE_FALSE';

      return (
        <div className={`grid grid-cols-2 gap-2 md:gap-3 lg:gap-4`}>
          {displayOptions.map((opt, idx) => {
            const isTrueFalse = gameState.current_turn.challenge_type === 'TRUE_FALSE';
            const isTrue = opt.toLowerCase() === 'true';
            const isSelected = selectedOption === opt;

            let btnClass = '';
            const isCorrectAnswer = opt === gameState.current_turn.correct_answer ||
              (isTrueFalse && opt.toUpperCase() === (gameState.current_turn.correct_answer || '').toUpperCase());

            if (isTrueFalse) {
              if (isSelected && wasWrong) {
                // Wrong answer selected - show red with shake
                btnClass = 'bg-red-500 border-red-600 text-white';
              } else if (isSelected) {
                btnClass = 'bg-green-500 border-green-600 text-white scale-105';
              } else if (wasWrong && isCorrectAnswer) {
                // Highlight correct answer when wrong
                btnClass = 'bg-green-500 border-green-600 text-white scale-105 ring-4 ring-green-300';
              } else {
                btnClass = isTrue
                  ? 'bg-gradient-to-br from-green-400 to-green-500 border-green-600 text-white hover:from-green-300 hover:to-green-400'
                  : 'bg-gradient-to-br from-red-400 to-red-500 border-red-600 text-white hover:from-red-300 hover:to-red-400';
              }
            } else {
              if (isSelected && wasWrong) {
                // Wrong answer selected - show red
                btnClass = 'bg-red-500 border-red-600 text-white';
              } else if (isSelected && !wasWrong) {
                // Correct answer - show green
                btnClass = 'bg-gradient-to-br from-green-400 to-green-500 border-green-600 text-white scale-105 ring-4 ring-green-300';
              } else if (wasWrong && isCorrectAnswer) {
                // Highlight correct answer when wrong
                btnClass = 'bg-green-500 border-green-600 text-white scale-105 ring-4 ring-green-300';
              } else {
                btnClass = 'bg-white/95 border-slate-200 text-slate-700 hover:bg-white hover:border-sky-300 hover:scale-[1.02]';
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleAction(opt)}
                disabled={isProcessing}
                style={{
                  opacity: showAnswers ? 1 : 0,
                  transform: showAnswers ? 'translateY(0)' : 'translateY(30px)',
                  transition: `all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 0.08}s`
                }}
                className={`
                  relative p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl font-bold text-xs md:text-base lg:text-lg text-center
                  border-b-2 md:border-b-4 shadow-lg backdrop-blur-sm
                  transition-all duration-200 active:scale-95 active:border-b-0 active:translate-y-1
                  ${btnClass}
                  ${isProcessing && !isSelected ? 'opacity-40 scale-95 grayscale' : ''}
                  ${isSelected && shakeWrong ? 'animate-shake' : ''}
                  disabled:cursor-not-allowed
                `}
              >
                <span className="flex items-center justify-center gap-1 md:gap-2">
                  {isTrueFalse ? (
                    isTrue
                      ? <><CheckIcon className="w-3.5 h-3.5 md:w-5 md:h-5" /> TRUE</>
                      : <><XMarkIcon className="w-3.5 h-3.5 md:w-5 md:h-5" /> FALSE</>
                  ) : (
                    <>{String.fromCharCode(65 + idx)}) {opt}</>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // TEXT_INPUT fallback (should rarely happen now)
    return (
      <div
        className="text-center text-white/60 py-4"
        style={{
          opacity: showAnswers ? 1 : 0,
          transition: 'all 0.5s ease-out'
        }}
      >
        <p className="font-bold">Loading question...</p>
      </div>
    );
  };

  // Mnemonic Forge Logic
  const forgeMnemonic = async (wrongAnswer: string) => {
    if (!gameState) return;
    setIsForgingMnemonic(true);
    setMnemonic(null);
    try {
      const result = await generateMnemonic(
        gameState.current_turn.question,
        gameState.current_turn.correct_answer || "Unknown",
        topicName || "General Knowledge",
        wrongAnswer
      );
      setMnemonic(result);
    } catch (error) {
      console.error("Failed to forge mnemonic", error);
    } finally {
      setIsForgingMnemonic(false);
    }
  };

  // End Game Screen
  if (gameState.game_status !== GameStatus.PLAYING) {
    const isWin = gameState.game_status === GameStatus.WON;

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        {backgroundImage && (
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center blur-md"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        )}

        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-[2rem] border-b-8 border-slate-200 p-8 shadow-2xl text-center">
            {/* Trophy/Skull Icon */}
            <div className={`inline-block p-5 rounded-full mb-6 ${isWin ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <span className="text-5xl">{isWin ? '🏆' : '💀'}</span>
            </div>

            <h1 className={`text-4xl font-black mb-2 ${isWin ? 'text-yellow-500' : 'text-red-500'}`}>
              {isWin ? 'VICTORY!' : 'DEFEATED'}
            </h1>

            <p className="text-slate-500 font-bold mb-6">
              {isWin ? 'You conquered the challenge!' : 'Better luck next time!'}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-black text-slate-800">{gameState.stats.streak}</div>
                <div className="text-xs font-bold text-slate-400 uppercase">Best Streak</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-black text-slate-800">{gameState.stats.total_turns}</div>
                <div className="text-xs font-bold text-slate-400 uppercase">Questions</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-2xl font-black text-green-600">{gameState.stats.turns_won}</div>
                <div className="text-xs font-bold text-green-500 uppercase">Correct</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-2xl font-black text-red-500">{gameState.stats.turns_lost}</div>
                <div className="text-xs font-bold text-red-400 uppercase">Wrong</div>
              </div>
            </div>



            {/* Buttons */}
            <div className="space-y-3">
              {missedQuestions.length > 0 && !showScholarReport && (
                <button
                  onClick={() => { soundManager.playButtonClick(); setShowScholarReport(true); }}
                  className="w-full py-4 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white border-b-4 border-purple-700 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
                >
                  <SparklesIcon className="w-6 h-6" />
                  View Study Guide
                </button>
              )}
              <button
                onClick={() => { soundManager.playButtonClick(); onGiveUp(); }}
                className="w-full py-4 bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-white border-b-4 border-sky-600 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>

        {/* Scholar's Report Overlay */}
        {
          showScholarReport && (
            <ScholarReport
              topicName={topicName}
              contextSummary={contextSummary}
              missedQuestions={missedQuestions}
              totalQuestions={gameState.stats.total_turns}
              correctAnswers={gameState.stats.turns_won}
              onClose={() => { setShowScholarReport(false); onGiveUp(); }}
              soundManager={soundManager}
            />
          )
        }
      </div >
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 overflow-hidden">
      {/* Background - full opacity during intro/attack, dimmed when question showing */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            opacity: (!showQuestion || attackingPlayer || attackingEnemy || playerShaking || enemyShaking) ? 1 : 0.4
          }}
        />
      )}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: 'linear-gradient(to bottom, transparent, transparent, rgba(0,0,0,0.1))',
          opacity: (!showQuestion || attackingPlayer || attackingEnemy || playerShaking || enemyShaking) ? 0 : 1
        }}
      />

      <div className="absolute top-0 left-0 right-0 z-50 p-3 md:p-4 flex justify-center">
        {/* Unified HUD Bar */}
        <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-2 md:p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 ring-1 ring-white/5 flex items-center gap-3 md:gap-6 max-w-fit mx-auto transition-all animate-slideDown">

          {/* Group 1: Session Info */}
          <div className="flex items-center gap-3 pr-3 md:pr-6 border-r border-white/10">
            {/* Topic */}
            <div className="hidden md:flex items-center gap-2 text-white/90">
              <BookOpenIcon className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-xs max-w-[120px] truncate">{gameState.topic_title || 'Study Session'}</span>
            </div>
            {/* Question Count */}
            <div className="flex items-center gap-1.5">
              <ClipboardDocumentListIcon className="w-4 h-4 text-sky-400" />
              <span className="font-black text-white text-sm">
                {gameState.stats.current_turn_index + 1}<span className="text-white/40 text-xs">/{gameState.stats.total_turns}</span>
              </span>
            </div>
          </div>

          {/* Group 2: Vitals (Streak & Mana) */}
          <div className="flex items-center gap-3 md:gap-6 pr-3 md:pr-6 border-r border-white/10">
            {/* Streak */}
            <div className="flex items-center gap-1.5" title="Current Streak">
              <FireIcon className="w-4 h-4 text-orange-500" />
              <span className="font-black text-white text-sm">{gameState.stats.streak}</span>
            </div>

            {/* Mana Bar */}
            <div className="flex items-center gap-2 min-w-[80px] md:min-w-[120px]">
              <BoltIcon className="w-4 h-4 text-blue-400" />
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-all duration-500"
                    style={{ width: `${(gameState.stats.mana / gameState.stats.max_mana) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Group 3: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Powerup */}
            {onUsePowerup && (
              <button
                onClick={() => onUsePowerup('SHIELD')}
                disabled={gameState.stats.mana < 30 || gameState.stats.active_powerups.some(p => p.type === 'SHIELD')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 text-purple-300 transition-all disabled:opacity-30 relative"
                title="Shield (30 mana)"
              >
                <ShieldCheckIcon className="w-4 h-4" />
                {gameState.stats.active_powerups.some(p => p.type === 'SHIELD') && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                )}
              </button>
            )}

            {/* Oracle */}
            <button
              onClick={() => {
                soundManager.playButtonClick();
                setOracleModeEnabled(!oracleModeEnabled);
                if (oracleModeEnabled) window.speechSynthesis.cancel();
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${oracleModeEnabled ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
            >
              <SpeakerWaveIcon className="w-4 h-4" />
            </button>

            {/* Hint */}
            <button
              onClick={handleWisdomScroll}
              disabled={isFetchingWisdom || showWisdomModal}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all ${isFetchingWisdom ? 'animate-pulse' : ''}`}
            >
              <LightBulbIcon className="w-4 h-4" />
            </button>

            {/* Exit */}
            <button
              onClick={() => { soundManager.playButtonClick(); onGiveUp(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-white/50 transition-all"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Narrative Title - Starts centered, moves to top after typewriter completes */}
      <div
        className="absolute left-0 right-0 z-30 px-2 md:px-4 flex items-center justify-center"
        style={{
          top: typewriterComplete ? '100px' : '50%', // Increased top offset to 100px
          transform: typewriterComplete ? 'translateY(0)' : 'translateY(-50%)',
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div className="max-w-2xl md:max-w-3xl w-full">
          <div
            className="bg-black/40 backdrop-blur-md rounded-xl md:rounded-2xl px-4 py-3 md:px-8 md:py-6 shadow-2xl border border-white/10"
            style={{
              opacity: (showNarrative && !selectedOption && !waitingForTurn) ? 1 : 0,
              transform: (showNarrative && !selectedOption && !waitingForTurn) ? 'scale(1)' : 'scale(0.95)',
              transition: 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <p className={`text-white font-medium leading-snug md:leading-relaxed text-center transition-all duration-500 ${typewriterComplete ? 'text-sm md:text-lg' : 'text-base md:text-xl'} flex items-center justify-center font-mono`}>
              <span className="italic text-sky-200">"{typewriterText}"</span>
              {!typewriterComplete && <span className="animate-pulse text-sky-400 w-2 inline-block">_</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Question Card - Upper area, below story */}
      <div className="absolute top-[180px] md:top-[260px] lg:top-[280px] left-0 right-0 z-40 pointer-events-none flex justify-center">
        <div className={`max-w-md md:max-w-xl lg:max-w-2xl w-full mx-auto px-4 md:px-6 ${(showQuestion && !showExplanation && !waitingForTurn) ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div
            className="bg-white/80 backdrop-blur-md rounded-2xl md:rounded-[1.5rem] border-b-2 md:border-b-4 border-slate-200/50 shadow-2xl overflow-hidden"
            style={{
              opacity: (showQuestion && !showExplanation && !waitingForTurn) ? 1 : 0,
              transform: (showQuestion && !showExplanation && !waitingForTurn) ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.95)',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Question */}
            <div className="p-4 md:p-6 lg:p-8 relative">
              <p className="text-slate-400 text-[10px] md:text-xs lg:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2 text-center">
                Question {gameState.stats.current_turn_index + 1}
              </p>
              <h2 className="text-slate-800 font-black text-sm md:text-lg lg:text-xl leading-snug md:leading-relaxed text-center mb-3 md:mb-5 lg:mb-6 flex items-center justify-center gap-2">
                {gameState.current_turn.question}
                {oracleModeEnabled && (
                  <button
                    onClick={() => speakLikeBoss(gameState.current_turn.question)}
                    className="p-1 rounded-full hover:bg-slate-100 text-purple-500"
                  >
                    <SpeakerWaveIcon className="w-4 h-4" />
                  </button>
                )}
              </h2>

              {/* Answers */}
              {renderAnswers()}

              {/* Voice Input Indicator (Floating or centered) */}
              {oracleModeEnabled && (
                <div className="flex justify-center mt-4">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); startListening(); }}
                    onMouseUp={(e) => { e.preventDefault(); stopListening(); }}
                    onMouseLeave={(e) => { e.preventDefault(); stopListening(); }}
                    onTouchStart={(e) => { e.preventDefault(); startListening(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
                    onClick={(e) => e.preventDefault()}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest transition-all select-none touch-none
                        ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95'}
                      `}
                  >
                    <MicrophoneIcon className="w-4 h-4" />
                    {isListening ? (transcript || "Listening...") : "Hold to Speak"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Characters - Bottom of Screen */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-0 md:pb-4 pointer-events-none">
        <div className="w-full flex justify-between items-end px-4 md:px-8 lg:px-8 xl:px-16">
          {/* Player - positioned to the left - LARGE */}
          <div
            ref={playerRef}
            style={{
              transform: attackingPlayer ? `translateX(${attackDistance}px)` : undefined
            }}
            className={`relative w-72 h-72 md:w-[450px] md:h-[450px] lg:w-[420px] lg:h-[420px] xl:w-[480px] xl:h-[480px] transition-all duration-700 ease-out
              ${playerShaking ? 'animate-shake' : ''}
              ${(showPlayer && !waitingForTurn) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-32'}
            `}
          >
            {/* HP Bar - Above player */}
            <div className={`absolute -top-10 md:-top-16 lg:-top-16 left-1/2 -translate-x-1/2 w-full max-w-[160px] md:max-w-[220px] lg:max-w-[200px] transition-opacity duration-300 ${(showPlayer && !waitingForTurn) ? 'opacity-100' : 'opacity-0'}`}>
              <div className="bg-black/60 backdrop-blur-sm rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[10px] md:text-sm lg:text-sm font-bold text-white/90">❤️ HP</span>
                </div>
                <div className="h-2 md:h-3.5 lg:h-3.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(gameState.stats.player_hp / gameState.stats.player_max_hp) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            {playerImage && (
              <TransparentImage
                src={playerImage}
                alt="Player"
                className="w-full h-full object-contain drop-shadow-2xl animate-[float_3s_ease-in-out_infinite]"
              />
            )}

            {/* Shield Visual Effect */}
            {gameState.stats.active_powerups.some(p => p.type === 'SHIELD') && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none z-20 flex items-center justify-center">
                <div className="w-full h-full rounded-full border-2 border-cyan-400/30 bg-cyan-400/5 shadow-[0_0_30px_rgba(34,211,238,0.2)] animate-shield-pulse backdrop-blur-[1px]">
                  <div className="absolute inset-0 w-full h-full rounded-full border-t-2 border-b-2 border-cyan-300/60 animate-spin-slow opacity-60" />
                  <div className="absolute inset-0 w-full h-full rounded-full border-l-2 border-r-2 border-blue-400/40 animate-spin-slow opacity-40 mix-blend-screen" style={{ animationDirection: 'reverse', animationDuration: '7s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Enemy - positioned to the right - LARGE */}
          <div
            ref={enemyRef}
            style={{
              transform: attackingEnemy ? `translateX(${attackDistance}px)` : undefined
            }}
            className={`relative w-72 h-72 md:w-[450px] md:h-[450px] lg:w-[420px] lg:h-[420px] xl:w-[480px] xl:h-[480px] transition-all duration-700 ease-out
              ${!waitingForTurn && enemyDefeated ? 'opacity-0 scale-90 duration-[1500ms]' : ''}
              ${!waitingForTurn && enemyFlyingAway ? 'translate-x-[200%] -translate-y-32 -rotate-45 scale-75 duration-1000' : ''}
              ${enemyShaking ? 'animate-shake' : ''}
              ${(!enemyDefeated && !enemyFlyingAway) || waitingForTurn ? 'opacity-100 translate-x-0' : ''}
            `}
          >
            {/* Boss Name - Above enemy, synced with showEnemy */}
            {bossImage && !enemyDefeated && !enemyFlyingAway && (
              <div
                className={`absolute -top-10 md:-top-16 lg:-top-16 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-300 ${showEnemy ? 'opacity-100' : 'opacity-0'}`}
              >
                <div className="bg-black/60 backdrop-blur-sm rounded-lg md:rounded-xl px-3 py-1.5 md:px-4 md:py-2">
                  <span className="text-white text-[10px] md:text-sm lg:text-sm font-black flex items-center gap-1 whitespace-nowrap">
                    <FaceFrownIcon className="w-4 h-4 text-red-400" />
                    {displayedBossName}
                  </span>
                </div>
              </div>
            )}
            {/* Boss image - always show when available (all images are pre-loaded) */}
            {bossImage && !enemyDefeated && !enemyFlyingAway && (
              <TransparentImage
                src={bossImage}
                alt="Enemy"
                className={`w-full h-full object-contain drop-shadow-2xl animate-[float_3s_ease-in-out_infinite_0.5s] transition-opacity duration-300 ${showEnemy ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Explanation Overlay */}
      {
        showExplanation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
              <div className="inline-block p-4 rounded-full bg-red-100 mb-4">
                <XMarkIcon className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Not quite!</h3>
              <p className="text-slate-500 font-bold mb-4">
                The correct answer was: <span className="text-green-600">{gameState.current_turn.correct_answer}</span>
              </p>
              {gameState.current_turn.answer_explanation && (
                <p className="text-slate-600 text-sm bg-slate-50 rounded-xl p-4 mb-6">
                  {gameState.current_turn.answer_explanation}
                </p>
              )}

              {/* Mnemonic Forge Card */}
              <div className="bg-purple-50 rounded-xl p-4 mb-6 border-2 border-purple-100 relative overflow-hidden">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Brain className="w-6 h-6 text-purple-700" />
                  <h4 className="font-extrabold text-purple-700 text-xs tracking-widest uppercase">Memory Anchor</h4>
                </div>

                {isForgingMnemonic ? (
                  <div className="flex flex-col items-center py-2 space-y-2">
                    <SparklesIcon className="w-6 h-6 text-purple-400 animate-spin" />
                    <p className="text-xs font-bold text-purple-400 animate-pulse">Forging Brain Hack...</p>
                  </div>
                ) : mnemonic ? (
                  <div className="relative z-10 animate-fadeScale">
                    <p className="text-purple-900 font-bold italic text-sm leading-relaxed">
                      "{mnemonic}"
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-purple-300">Could not forge mnemonic.</p>
                )}

                {/* Decorative background sparkle */}
                <SparklesIcon className="absolute -bottom-4 -right-4 w-20 h-20 text-purple-200/50 rotate-12" />
              </div>
              <button
                onClick={() => { soundManager.playButtonClick(); dismissExplanation(); }}
                className="w-full py-4 bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-white border-b-4 border-sky-600 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1"
              >
                {dismissButtonText}
              </button>
            </div>
          </div>
        )
      }

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeScale {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-fadeScale {
          animation: fadeScale 0.5s ease-out forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-12px) rotate(-1deg); }
          20% { transform: translateX(12px) rotate(1deg); }
          30% { transform: translateX(-12px) rotate(-1deg); }
          40% { transform: translateX(12px) rotate(1deg); }
          50% { transform: translateX(-8px); }
          60% { transform: translateX(8px); }
          70% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          90% { transform: translateX(-2px); }
        }
        .animate-shake {
          animation: shake 0.7s ease-in-out;
        }
        @keyframes shieldPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; box-shadow: 0 0 20px rgba(34,211,238,0.3); }
          50% { transform: scale(1.02); opacity: 0.7; box-shadow: 0 0 40px rgba(34,211,238,0.6); }
        }
        .animate-shield-pulse {
          animation: shieldPulse 3s ease-in-out infinite;
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spinSlow 10s linear infinite;
        }
      `}</style>
      {/* Wisdom Scroll Modal */}
      {showWisdomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-amber-100 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border-[6px] border-amber-800/80 relative rotate-1">
            {/* Scroll Decoration */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-8 bg-amber-900 rounded-full shadow-lg border-2 border-amber-700" />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-32 h-8 bg-amber-900 rounded-full shadow-lg border-2 border-amber-700" />

            <button
              onClick={() => setShowWisdomModal(false)}
              className="absolute top-4 right-4 text-amber-900/50 hover:text-amber-900"
            >
              <XMarkIcon className="w-8 h-8" />
            </button>

            <div className="text-center mt-4 mb-2">
              <Scroll className="w-10 h-10 text-amber-900 mx-auto mb-2" />
              <h3 className="font-serif font-black text-2xl text-amber-900 uppercase tracking-widest">Ancient Wisdom</h3>
            </div>

            <div className="bg-amber-50 p-6 rounded-xl border-2 border-amber-900/10 min-h-[120px] flex items-center justify-center">
              <p className="font-serif text-xl text-amber-900 italic text-center font-bold leading-relaxed">
                "{wisdomHint || "Focus on the question..."}"
              </p>
            </div>

            <button
              onClick={() => setShowWisdomModal(false)}
              className="w-full mt-6 py-3 bg-amber-800 hover:bg-amber-900 text-amber-100 font-bold rounded-xl shadow-lg transition-all active:scale-95 text-lg uppercase tracking-wide border-b-4 border-amber-950"
            >
              Thank you, Sage
            </button>
          </div>
        </div>
      )}

    </div >
  );
};