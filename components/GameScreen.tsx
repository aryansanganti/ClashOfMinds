import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, GameStatus } from '../types';
import { ProgressBar } from './ProgressBar';
import { TransparentImage } from './TransparentImage';
import { StarIcon, XMarkIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { useSoundManager } from '../hooks/useSoundManager';
import { RaidState, Player } from '../types';

const RaidHUD: React.FC<{ raid: RaidState }> = ({ raid }) => {
  return (
    <div className="absolute top-20 right-4 w-64 z-40 bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-xl ml-auto animate-slideInRight hidden lg:block text-white">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-black text-red-400 text-sm uppercase tracking-widest">Global Boss HP</h3>
          <span className="font-bold text-xs">{Math.ceil(raid.boss_hp)} / {raid.boss_max_hp}</span>
        </div>
        <div className="h-3 bg-red-900/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-500"
            style={{ width: `${(raid.boss_hp / raid.boss_max_hp) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-black text-slate-300 text-[10px] uppercase tracking-widest mb-2">Raid Party</h3>
        {raid.players?.filter(p => p.is_bot).map(bot => (
          <div key={bot.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-lg shadow-inner">
              {bot.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs truncate">{bot.name}</span>
                <span className={`text-[10px] font-bold ${bot.status === 'ATTACKING' ? 'text-green-400' : bot.status === 'HIT' ? 'text-red-400' : 'text-slate-400'}`}>
                  {bot.status}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bot.hp < 30 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${(bot.hp / bot.max_hp) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {raid.log && raid.log.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-[10px] text-slate-300 font-mono opacity-80">
            {raid.log[raid.log.length - 1]}
          </div>
        </div>
      )}
    </div>
  );
};


interface GameScreenProps {
  gameState: GameState;
  bossImage: string | null;
  playerImage: string | null;
  backgroundImage: string | null;
  onAction: (answer: string, isCorrect: boolean) => void;
  onTransitionComplete: () => void;
  onGiveUp: () => void;
  soundManager: ReturnType<typeof useSoundManager>;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  bossImage,
  playerImage,
  backgroundImage,
  onAction,
  onTransitionComplete,
  onGiveUp,
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

  // Refs for dynamic movement calculation
  const playerRef = useRef<HTMLDivElement>(null);
  const enemyRef = useRef<HTMLDivElement>(null);
  const [attackDistance, setAttackDistance] = useState<number>(0);

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

  // --- RAID SIMULATION STATE ---
  const [raidState, setRaidState] = useState<RaidState | undefined>(gameState.raid);

  // Update local raid state if props change (though we manage it locally mostly)
  useEffect(() => {
    if (gameState.raid) {
      // Only update if we don't have one, or to sync major changes? 
      // For now, let's initialize if missing
      if (!raidState) setRaidState(gameState.raid);
    }
  }, [gameState.raid]);

  // Simulate bot turns whenever turn index changes
  useEffect(() => {
    if (!raidState || !waitingForTurn) return;

    // Simulate bots after a small delay
    const t = setTimeout(() => {
      setRaidState(prev => {
        if (!prev) return undefined;
        const newPrev = { ...prev, log: [...prev.log] };

        // Randomly pick a bot to attack
        const activeBots = newPrev.players.filter(p => p.is_bot && p.hp > 0);
        activeBots.forEach(bot => {
          if (Math.random() > 0.3) {
            bot.status = 'ATTACKING';
            newPrev.boss_hp = Math.max(0, newPrev.boss_hp - (Math.random() * 5 + 5));
            newPrev.log.push(`${bot.name} used ${bot.sub_topic} Attack!`);
          } else {
            bot.status = 'HIT';
            bot.hp = Math.max(0, bot.hp - 10);
            newPrev.log.push(`${bot.name} took damage!`);
          }
        });

        return { ...newPrev };
      });

      // Reset status after delay
      setTimeout(() => {
        setRaidState(prev => {
          if (!prev) return undefined;
          const newPrev = { ...prev };
          newPrev.players.forEach(p => { if (p.is_bot) p.status = 'IDLE'; });
          return { ...newPrev };
        });
      }, 1500);

    }, 2000);

    return () => clearTimeout(t);
  }, [gameState.stats.current_turn_index]);


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
            const isTrue = opt.toUpperCase() === 'TRUE';
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

            <button
              onClick={() => { soundManager.playButtonClick(); onGiveUp(); }}
              className="w-full py-4 bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-white border-b-4 border-sky-600 rounded-2xl font-black text-lg uppercase tracking-wide shadow-lg transition-all active:border-b-0 active:translate-y-1"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
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

      {/* Raid HUD */}
      {raidState && <RaidHUD raid={raidState} />}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-3 md:p-4">
        <div className="max-w-5xl mx-auto flex justify-center items-center">
          {/* Centered HUD Container */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Topic Title */}
            <div className="bg-black/60 backdrop-blur-md rounded-2xl px-3 py-2 md:px-4 md:py-2.5 shadow-lg border border-white/10 flex items-center gap-2 max-w-[140px] md:max-w-[200px]">
              <span className="text-purple-400 text-lg">📚</span>
              <span className="font-bold text-white/90 text-xs md:text-sm truncate">{gameState.topic_title || 'Study Session'}</span>
            </div>
            {/* Streak */}
            <div className="bg-black/60 backdrop-blur-md rounded-2xl px-3 py-2 md:px-4 md:py-2.5 shadow-lg border border-white/10 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-400 text-lg">🔥</span>
                <span className="font-black text-white text-sm md:text-base">{gameState.stats.streak}</span>
              </div>
              <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase hidden sm:block">Streak</span>
            </div>
            {/* Question Progress */}
            <div className="bg-black/60 backdrop-blur-md rounded-2xl px-3 py-2 md:px-4 md:py-2.5 shadow-lg border border-white/10 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sky-400 text-lg">📝</span>
                <span className="font-black text-white text-sm md:text-base">
                  {gameState.stats.current_turn_index + 1}<span className="text-white/50 font-bold">/{gameState.stats.total_turns}</span>
                </span>
              </div>
              <span className="text-white/50 text-[10px] md:text-xs font-bold uppercase hidden sm:block">Question</span>
            </div>
            {/* Give Up */}
            <button
              onClick={() => { soundManager.playButtonClick(); onGiveUp(); }}
              className="bg-black/60 backdrop-blur-md rounded-2xl p-2.5 shadow-lg border border-white/10 hover:bg-red-500/80 transition-all group"
            >
              <XMarkIcon className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Narrative Title - Starts centered, moves to top after typewriter completes */}
      <div
        className="absolute left-0 right-0 z-30 px-2 md:px-4 flex items-center justify-center"
        style={{
          top: typewriterComplete ? '52px' : '50%',
          transform: typewriterComplete ? 'translateY(0)' : 'translateY(-50%)',
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div className="max-w-2xl md:max-w-3xl w-full">
          <div
            className="bg-black/50 backdrop-blur-md rounded-xl md:rounded-2xl px-3 py-2 md:px-8 md:py-5 shadow-2xl border border-white/10"
            style={{
              opacity: (showNarrative && !selectedOption && !waitingForTurn) ? 1 : 0,
              transform: (showNarrative && !selectedOption && !waitingForTurn) ? 'scale(1)' : 'scale(0.95)',
              transition: 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <p className={`text-white font-bold leading-snug md:leading-relaxed text-center transition-all duration-500 ${typewriterComplete ? 'text-xs md:text-xl' : 'text-sm md:text-2xl'}`}>
              <span className="text-yellow-400/80 mr-1 md:mr-2">✦</span>
              <span className="italic">"{typewriterText}"</span>
              {!typewriterComplete && <span className="animate-pulse text-yellow-400">|</span>}
              <span className="text-yellow-400/80 ml-1 md:ml-2">✦</span>
            </p>
          </div>
        </div>
      </div>

      {/* Question Card - Upper area, below story */}
      <div className="absolute top-[115px] md:top-[220px] lg:top-[240px] left-0 right-0 z-40 pointer-events-none flex justify-center">
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
            <div className="p-4 md:p-6 lg:p-8">
              <p className="text-slate-400 text-[10px] md:text-xs lg:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2 text-center">
                Question {gameState.stats.current_turn_index + 1}
              </p>
              <h2 className="text-slate-800 font-black text-sm md:text-lg lg:text-xl leading-snug md:leading-relaxed text-center mb-3 md:mb-5 lg:mb-6">
                {gameState.current_turn.question}
              </h2>

              {/* Answers */}
              {renderAnswers()}
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
                    <span className="text-red-400">👹</span>
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
      `}</style>
    </div >
  );
};