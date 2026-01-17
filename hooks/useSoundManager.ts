import { useRef, useCallback, useEffect, useState } from 'react';

// Sound file paths
const SOUND_PATHS = {
    buttonClick: '/sounds/button_click.wav',
    playerAttack: '/sounds/player_attack.wav',
    enemyDamage: '/sounds/enemy_damage.wav',
    enemyAttack: '/sounds/enemy_attack.wav',
    playerDamage: '/sounds/player_damage.wav',
    correctAnswer: '/sounds/correct_answer.wav',
    wrongAnswer: '/sounds/wrong_answer.wav',
    victory: '/sounds/victory.wav',
    defeat: '/sounds/defeat.wav',
    appearChar: '/sounds/appear_char.wav', 
    appearUI: '/sounds/appear_ui.wav',     
} as const;

type SoundType = keyof typeof SOUND_PATHS;
type MusicType = 'LOADING' | 'BATTLE' | 'NONE';

const STORAGE_KEY = 'battlenotes_sound_enabled';

export const useSoundManager = () => {
    const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === null ? true : stored === 'true';
    });

    const audioRefs = useRef<Map<SoundType, HTMLAudioElement>>(new Map());
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // Music State
    const currentMusicType = useRef<MusicType>('NONE');
    const nextNoteTime = useRef<number>(0);
    const sequencerTimer = useRef<number | null>(null);
    const beatCount = useRef<number>(0);

    // Persist sound setting
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(isSoundEnabled));
    }, [isSoundEnabled]);

    // Initialize AudioContext
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(e => console.warn("Audio Context resume failed", e));
        }
        return audioContextRef.current;
    }, []);

    // Preload audio files
    useEffect(() => {
        Object.entries(SOUND_PATHS).forEach(([key, path]) => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.onerror = () => { audio.dataset.broken = 'true'; };
            audio.volume = 1.0; // Max volume for files, let logic control perceived mix
            audioRefs.current.set(key as SoundType, audio);
        });

        return () => {
            stopMusic();
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // --- PROCEDURAL MUSIC SEQUENCER ---
    
    const playSynthNote = (
        ctx: AudioContext, 
        freq: number, 
        time: number, 
        duration: number, 
        vol: number = 0.1, 
        type: OscillatorType = 'square',
        attack: number = 0
    ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Envelope
        if (attack > 0) {
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(vol, time + attack);
        } else {
            gain.gain.setValueAtTime(vol, time);
        }
        
        // Release
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc.start(time);
        osc.stop(time + duration);
    };

    const playNoise = (ctx: AudioContext, time: number, duration: number, vol: number = 0.05) => {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        
        // Reverted to Highpass for crispier drums (Battle Theme)
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        noise.start(time);
    };

    const scheduler = useCallback(() => {
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const scheduleAheadTime = 0.1; 

        while (nextNoteTime.current < ctx.currentTime + scheduleAheadTime) {
            const beat = beatCount.current;
            const t = nextNoteTime.current;

            if (currentMusicType.current === 'LOADING') {
                // --- LOADING THEME: "Zen Space Drone" ---
                const noteDuration = 0.25; 
                const cyclePos = beat % 32;

                // 1. The "Void" Drone
                if (cyclePos === 0) {
                     playSynthNote(ctx, 55.00, t, 8.0, 0.06, 'sine', 2.0);
                     playSynthNote(ctx, 55.50, t, 8.0, 0.06, 'sine', 2.5);
                }

                // 2. Ethereal Pads
                if (cyclePos === 4) {
                    [220.00, 261.63, 329.63, 493.88].forEach((f, i) => {
                         playSynthNote(ctx, f, t + i*0.2, 5.0, 0.015, 'sine', 1.5);
                    });
                }
                
                if (cyclePos === 20) {
                    [174.61, 220.00, 261.63, 329.63].forEach((f, i) => {
                         playSynthNote(ctx, f, t + i*0.2, 5.0, 0.015, 'sine', 1.5);
                    });
                }

                // 3. Sparkles
                if (Math.random() < 0.15) {
                    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
                    const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
                    playSynthNote(ctx, freq, t, 2.0, 0.01, 'sine', 0.1); 
                }

                nextNoteTime.current += noteDuration;
                beatCount.current++;
            } 
            else if (currentMusicType.current === 'BATTLE') {
                // --- BATTLE THEME (Restored to previous version) ---
                const noteDuration = 0.14; 
                const measurePos = beat % 16; 

                // Bass Line
                let bassFreq = 0;
                if ([0, 2, 4, 6].includes(measurePos)) bassFreq = 110; // A2
                if ([8, 10].includes(measurePos)) bassFreq = 130.81; // C3
                if ([12, 14].includes(measurePos)) bassFreq = 98.00; // G2

                if (bassFreq > 0) {
                    playSynthNote(ctx, bassFreq, t, 0.1, 0.02, 'square');
                }

                // Drums
                if (measurePos % 4 === 0) {
                   // Kick
                   playSynthNote(ctx, 60, t, 0.1, 0.04, 'sine');
                }
                if (measurePos % 2 !== 0) {
                   // Hi-hat
                   playNoise(ctx, t, 0.05, 0.005);
                }
                if (measurePos === 4 || measurePos === 12) {
                   // Snare - Restored volume but kept slightly lower than original to avoid "too loud" complaint
                   playNoise(ctx, t, 0.1, 0.012); 
                }

                nextNoteTime.current += noteDuration;
                beatCount.current++;
            } else {
                nextNoteTime.current += 0.5; 
            }
        }
        
        sequencerTimer.current = window.setTimeout(scheduler, 25);
    }, []);

    const startMusic = useCallback((type: MusicType) => {
        if (!isSoundEnabled) return;
        const ctx = initAudioContext();
        if (!ctx) return;

        if (currentMusicType.current !== type) {
            beatCount.current = 0;
            nextNoteTime.current = ctx.currentTime + 0.1;
        }
        currentMusicType.current = type;
        if (sequencerTimer.current === null) {
            scheduler();
        }
    }, [isSoundEnabled, initAudioContext, scheduler]);

    const stopMusic = useCallback(() => {
        currentMusicType.current = 'NONE';
        if (sequencerTimer.current !== null) {
            clearTimeout(sequencerTimer.current);
            sequencerTimer.current = null;
        }
    }, []);

    // --- EFFECTS ---

    const playTransitionEffect = useCallback(() => {
        if (!isSoundEnabled) return;
        const ctx = initAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.6);
        
        // Flutter effect
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 15;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + 0.6);

        // Transition Volume: 0.05
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);

        osc.start(now);
        osc.stop(now + 0.6);
    }, [isSoundEnabled, initAudioContext]);

    // --- SYNTH FALLBACKS (FULL IMPLEMENTATION) ---
    const playSynthFallback = useCallback((type: SoundType) => {
        const ctx = initAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        switch (type) {
            case 'buttonClick':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
                break;
            case 'appearChar':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.3);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.15);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
                break;
            case 'appearUI':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
                break;
            case 'playerAttack': // "Whoosh"
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
                break;
            case 'enemyAttack': // Lower "Whoosh"
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
                break;
            case 'enemyDamage': // "Crunch"
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
                break;
            case 'playerDamage': // "Thud"
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
                break;
            case 'correctAnswer': // "Ping!"
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.setValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                osc.start(now); osc.stop(now + 0.5);
                break;
            case 'wrongAnswer': // "Buzz"
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
                break;
            case 'victory':
                 [523, 659, 784, 1046].forEach((f, i) => {
                     const o = ctx.createOscillator();
                     const g = ctx.createGain();
                     o.type='triangle'; o.frequency.value=f;
                     o.connect(g); g.connect(ctx.destination);
                     g.gain.setValueAtTime(0.1, now + i*0.1);
                     g.gain.linearRampToValueAtTime(0, now + i*0.1 + 0.3);
                     o.start(now + i*0.1); o.stop(now + i*0.1 + 0.3);
                 });
                 break;
            case 'defeat':
                 [400, 350, 300, 250].forEach((f, i) => {
                     const o = ctx.createOscillator();
                     const g = ctx.createGain();
                     o.type='sawtooth'; o.frequency.value=f;
                     o.connect(g); g.connect(ctx.destination);
                     g.gain.setValueAtTime(0.1, now + i*0.3);
                     g.gain.linearRampToValueAtTime(0, now + i*0.3 + 0.4);
                     o.start(now + i*0.3); o.stop(now + i*0.3 + 0.4);
                 });
                 break;
        }
    }, [initAudioContext]);

    const playSound = useCallback((type: SoundType) => {
        if (!isSoundEnabled) return;
        initAudioContext();
        const audio = audioRefs.current.get(type);
        
        // Always try to play file first
        if (audio && audio.dataset.broken !== 'true') {
            const clone = audio.cloneNode() as HTMLAudioElement;
            clone.volume = audio.volume;
            clone.play().catch(() => {
                // If play fails (e.g. not loaded), fallback immediately
                playSynthFallback(type);
            });
        } else {
            // If marked broken or missing, fallback
            playSynthFallback(type);
        }
    }, [isSoundEnabled, initAudioContext, playSynthFallback]);

    const toggleSound = useCallback(() => {
        setIsSoundEnabled(prev => {
            const newValue = !prev;
            if (newValue) {
                initAudioContext();
                if (currentMusicType.current !== 'NONE') {
                    startMusic(currentMusicType.current);
                }
            } else {
                stopMusic();
            }
            return newValue;
        });
    }, [initAudioContext, startMusic, stopMusic]);

    return {
        isSoundEnabled,
        toggleSound,
        playLoadingMusic: useCallback(() => startMusic('LOADING'), [startMusic]),
        playBattleMusic: useCallback(() => startMusic('BATTLE'), [startMusic]),
        playTransition: playTransitionEffect,
        stopMusic,
        playButtonClick: useCallback(() => playSound('buttonClick'), [playSound]),
        playAppearCharacter: useCallback(() => playSound('appearChar'), [playSound]),
        playAppearUI: useCallback(() => playSound('appearUI'), [playSound]),
        playPlayerAttack: useCallback(() => playSound('playerAttack'), [playSound]),
        playEnemyDamage: useCallback(() => playSound('enemyDamage'), [playSound]),
        playEnemyAttack: useCallback(() => playSound('enemyAttack'), [playSound]),
        playPlayerDamage: useCallback(() => playSound('playerDamage'), [playSound]),
        playCorrectAnswer: useCallback(() => playSound('correctAnswer'), [playSound]),
        playWrongAnswer: useCallback(() => playSound('wrongAnswer'), [playSound]),
        playVictory: useCallback(() => playSound('victory'), [playSound]),
        playDefeat: useCallback(() => playSound('defeat'), [playSound]),
    };
};