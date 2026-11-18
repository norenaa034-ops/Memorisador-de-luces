import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {AnimatePresence, MotionConfig, motion} from 'motion/react';
import {
  playErrorBuzzer,
  playPadTone,
  playRoundClearChime,
  type PadId,
} from './utils/sound';

const RECORD_STORAGE_KEY = 'simon_dice_record_maximo_v1';

type GamePhase =
  | 'IDLE'
  | 'SHOWING_SEQUENCE'
  | 'PLAYER_TURN'
  | 'ROUND_COMPLETE'
  | 'GAME_OVER';

interface PadConfig {
  id: PadId;
  label: string;
  keyHint: string;
  cornerRadius: string;
  labelPosition: string;
  idleClass: string;
  litClass: string;
  dotColor: string;
}

const PADS: PadConfig[] = [
  {
    id: 'green',
    label: 'Verde',
    keyHint: '1',
    cornerRadius: 'rounded-tl-[999px] rounded-tr-2xl rounded-bl-2xl rounded-br-xl',
    labelPosition: 'items-end justify-end pb-7 pr-7 sm:pb-8 sm:pr-8',
    idleClass:
      'bg-emerald-950/75 border-2 border-emerald-500/45 text-emerald-300/90 hover:bg-emerald-900/65 hover:border-emerald-400/75',
    litClass:
      'bg-emerald-400 border-2 border-emerald-100 text-slate-950 scale-[0.97] shadow-[0_0_52px_rgba(52,211,153,0.9),inset_0_0_24px_rgba(255,255,255,0.55)]',
    dotColor: 'text-emerald-400',
  },
  {
    id: 'red',
    label: 'Rojo',
    keyHint: '2',
    cornerRadius: 'rounded-tr-[999px] rounded-tl-2xl rounded-br-2xl rounded-bl-xl',
    labelPosition: 'items-end justify-start pb-7 pl-7 sm:pb-8 sm:pl-8',
    idleClass:
      'bg-rose-950/75 border-2 border-rose-500/45 text-rose-300/90 hover:bg-rose-900/65 hover:border-rose-400/75',
    litClass:
      'bg-rose-400 border-2 border-rose-100 text-slate-950 scale-[0.97] shadow-[0_0_52px_rgba(251,113,133,0.9),inset_0_0_24px_rgba(255,255,255,0.55)]',
    dotColor: 'text-rose-400',
  },
  {
    id: 'yellow',
    label: 'Amarillo',
    keyHint: '3',
    cornerRadius: 'rounded-bl-[999px] rounded-tl-2xl rounded-br-2xl rounded-tr-xl',
    labelPosition: 'items-start justify-end pt-7 pr-7 sm:pt-8 sm:pr-8',
    idleClass:
      'bg-amber-950/70 border-2 border-amber-400/45 text-amber-200/90 hover:bg-amber-900/60 hover:border-amber-300/75',
    litClass:
      'bg-amber-300 border-2 border-amber-50 text-slate-950 scale-[0.97] shadow-[0_0_52px_rgba(252,211,77,0.95),inset_0_0_24px_rgba(255,255,255,0.6)]',
    dotColor: 'text-amber-300',
  },
  {
    id: 'blue',
    label: 'Azul',
    keyHint: '4',
    cornerRadius: 'rounded-br-[999px] rounded-tr-2xl rounded-bl-2xl rounded-tl-xl',
    labelPosition: 'items-start justify-start pt-7 pl-7 sm:pt-8 sm:pl-8',
    idleClass:
      'bg-blue-950/80 border-2 border-blue-500/45 text-blue-300/90 hover:bg-blue-900/65 hover:border-blue-400/75',
    litClass:
      'bg-blue-400 border-2 border-blue-100 text-slate-950 scale-[0.97] shadow-[0_0_52px_rgba(96,165,250,0.95),inset_0_0_24px_rgba(255,255,255,0.55)]',
    dotColor: 'text-blue-400',
  },
];

const PAD_IDS: PadId[] = ['green', 'red', 'yellow', 'blue'];

const KEY_TO_PAD: Record<string, PadId> = {
  '1': 'green',
  q: 'green',
  '2': 'red',
  w: 'red',
  '3': 'yellow',
  a: 'yellow',
  '4': 'blue',
  s: 'blue',
};

function getPadLabel(id: PadId | null): string {
  return PADS.find((p) => p.id === id)?.label ?? '';
}

function getRandomPad(): PadId {
  return PAD_IDS[Math.floor(Math.random() * PAD_IDS.length)];
}

function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(RECORD_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score: number): void {
  try {
    localStorage.setItem(RECORD_STORAGE_KEY, String(score));
  } catch {
    // Ignore storage failures in restricted browsing contexts
  }
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('IDLE');
  const [sequence, setSequence] = useState<PadId[]>([]);
  const [playerIndex, setPlayerIndex] = useState<number>(0);
  const [activePad, setActivePad] = useState<PadId | null>(null);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => loadHighScore());
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shakeKey, setShakeKey] = useState<number>(0);
  const [mistakeInfo, setMistakeInfo] = useState<{
    pressed: PadId;
    expected: PadId;
  } | null>(null);

  const timersRef = useRef<number[]>([]);
  const runIdRef = useRef<number>(0);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const playSequence = useCallback(
    (seq: PadId[], activeRunId: number) => {
      clearAllTimers();
      setPhase('SHOWING_SEQUENCE');
      setPlayerIndex(0);
      setActivePad(null);

      // Progressive arcade pacing: starts comfortable and tightens as levels grow
      const stepInterval = Math.max(360, 620 - (seq.length - 1) * 22);
      const litDuration = Math.max(210, Math.round(stepInterval * 0.62));
      const initialDelay = 380;

      seq.forEach((pad, idx) => {
        const startAt = initialDelay + idx * stepInterval;

        scheduleTimeout(() => {
          if (runIdRef.current !== activeRunId) return;
          setActivePad(pad);
          playPadTone(pad, litDuration, soundEnabledRef.current);
        }, startAt);

        scheduleTimeout(() => {
          if (runIdRef.current !== activeRunId) return;
          setActivePad((curr) => (curr === pad ? null : curr));
        }, startAt + litDuration);
      });

      const sequenceEndAt = initialDelay + seq.length * stepInterval + 80;
      scheduleTimeout(() => {
        if (runIdRef.current !== activeRunId) return;
        setActivePad(null);
        setPhase('PLAYER_TURN');
      }, sequenceEndAt);
    },
    [clearAllTimers, scheduleTimeout],
  );

  const startNewGame = useCallback(() => {
    clearAllTimers();
    runIdRef.current += 1;
    const currentRunId = runIdRef.current;

    const firstSequence: PadId[] = [getRandomPad()];
    setSequence(firstSequence);
    setPlayerIndex(0);
    setScore(0);
    setIsNewRecord(false);
    setMistakeInfo(null);
    setActivePad(null);

    playSequence(firstSequence, currentRunId);
  }, [clearAllTimers, playSequence]);

  const handlePadPress = useCallback(
    (pad: PadId) => {
      // Allow testing pad tones and glow while idle before starting
      if (phase === 'IDLE') {
        setActivePad(pad);
        playPadTone(pad, 200, soundEnabledRef.current);
        scheduleTimeout(() => {
          setActivePad((curr) => (curr === pad ? null : curr));
        }, 200);
        return;
      }

      if (phase !== 'PLAYER_TURN') return;

      const currentRunId = runIdRef.current;
      const expectedPad = sequence[playerIndex];

      if (pad === expectedPad) {
        // Correct step: immediate visual glow and musical tone
        setActivePad(pad);
        playPadTone(pad, 220, soundEnabledRef.current);
        scheduleTimeout(() => {
          if (runIdRef.current !== currentRunId) return;
          setActivePad((curr) => (curr === pad ? null : curr));
        }, 210);

        const nextIdx = playerIndex + 1;

        if (nextIdx === sequence.length) {
          // Round completed!
          const newScore = sequence.length;
          setScore(newScore);

          if (newScore > highScore) {
            setHighScore(newScore);
            saveHighScore(newScore);
            setIsNewRecord(true);
          }

          setPhase('ROUND_COMPLETE');
          const nextSequence = [...sequence, getRandomPad()];

          scheduleTimeout(() => {
            if (runIdRef.current !== currentRunId) return;
            playRoundClearChime(soundEnabledRef.current);
          }, 220);

          scheduleTimeout(() => {
            if (runIdRef.current !== currentRunId) return;
            setSequence(nextSequence);
            playSequence(nextSequence, currentRunId);
          }, 820);
        } else {
          setPlayerIndex(nextIdx);
        }
      } else {
        // Mistake: stop timers, trigger visual shake + buzzer + Game Over screen
        clearAllTimers();
        runIdRef.current += 1;
        setActivePad(null);
        setMistakeInfo({pressed: pad, expected: expectedPad});
        setPhase('GAME_OVER');
        setShakeKey((k) => k + 1);
        playErrorBuzzer(soundEnabledRef.current);

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([120, 40, 160]);
          } catch {
            // Ignore vibrate permission errors
          }
        }
      }
    },
    [
      clearAllTimers,
      highScore,
      phase,
      playerIndex,
      playSequence,
      scheduleTimeout,
      sequence,
    ],
  );

  // Keyboard shortcuts (1/2/3/4 or Q/W/A/S, plus Enter/Space to start when idle/game over)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      if (key in KEY_TO_PAD) {
        e.preventDefault();
        handlePadPress(KEY_TO_PAD[key]);
        return;
      }

      if ((key === 'enter' || key === ' ') && (phase === 'IDLE' || phase === 'GAME_OVER')) {
        e.preventDefault();
        startNewGame();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePadPress, phase, startNewGame]);

  const currentLevel = sequence.length > 0 ? sequence.length : 1;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#080B12] text-slate-100">
      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-[#0B101B]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white truncate">
            Simón Dice
          </span>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3 sm:px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'Sonido' : 'Silencio'}</span>
            </button>

            {phase !== 'IDLE' && (
              <button
                type="button"
                onClick={startNewGame}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Reiniciar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Arcade Arena */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left / Center: Circular 4-Button Neon Console */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            <motion.div
              animate={
                phase === 'GAME_OVER' && shakeKey > 0
                  ? {
                      x: [0, -14, 14, -10, 10, -5, 5, 0],
                      rotate: [0, -1.5, 1.5, -1, 1, 0],
                    }
                  : {x: 0, rotate: 0}
              }
              transition={{duration: 0.42, ease: 'easeOut'}}
              className={`relative w-[min(88vw,370px)] sm:w-[410px] aspect-square rounded-full p-3.5 sm:p-5 bg-[#0F1624] transition-shadow duration-200 ${
                phase === 'GAME_OVER'
                  ? 'border-2 border-rose-500/80 shadow-[0_0_55px_rgba(244,63,94,0.3)]'
                  : 'border border-slate-800 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.9)]'
              }`}
            >
              {/* 2x2 Quadrant Grid forming circular arcade disc */}
              <div
                className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 w-full h-full"
                role="group"
                aria-label="Tablero de colores de Simón Dice"
              >
                {PADS.map((pad) => {
                  const isLit = activePad === pad.id;
                  const isExpectedOnLoss =
                    phase === 'GAME_OVER' && mistakeInfo?.expected === pad.id;
                  const isInteractive = phase === 'IDLE' || phase === 'PLAYER_TURN';

                  return (
                    <button
                      key={pad.id}
                      type="button"
                      onClick={() => handlePadPress(pad.id)}
                      disabled={!isInteractive}
                      aria-label={`${pad.label} (Tecla ${pad.keyHint})`}
                      className={`relative flex ${pad.labelPosition} ${pad.cornerRadius} select-none transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        isInteractive ? 'cursor-pointer active:scale-[0.97]' : 'cursor-default'
                      } ${
                        isLit
                          ? pad.litClass
                          : isExpectedOnLoss
                            ? `${pad.idleClass} ring-2 ring-white/90 brightness-125`
                            : pad.idleClass
                      }`}
                    >
                      <span className="flex flex-col items-center gap-0.5 pointer-events-none">
                        <span className="text-xs sm:text-sm font-semibold tracking-wide">
                          {pad.label}
                        </span>
                        <span
                          className={`hidden sm:inline text-[11px] font-mono ${
                            isLit ? 'text-slate-900/75 font-bold' : 'opacity-60'
                          }`}
                        >
                          {pad.keyHint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Central Arcade Hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#080B12] border-4 border-[#1A2438] shadow-[0_8px_30px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center text-center p-2 z-10">
                {phase === 'IDLE' ? (
                  <button
                    type="button"
                    onClick={startNewGame}
                    className="w-full h-full rounded-full flex flex-col items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                    <span className="text-xs sm:text-sm">Iniciar</span>
                  </button>
                ) : phase === 'SHOWING_SEQUENCE' ? (
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-amber-300">Observa</p>
                    <p className="font-display text-lg sm:text-xl font-bold text-white tabular-nums">
                      Niv. {currentLevel}
                    </p>
                  </div>
                ) : phase === 'PLAYER_TURN' ? (
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-emerald-400">Tu turno</p>
                    <p className="font-mono text-base sm:text-lg font-bold text-white tabular-nums">
                      {playerIndex}/{sequence.length}
                    </p>
                  </div>
                ) : phase === 'ROUND_COMPLETE' ? (
                  <div className="space-y-0.5">
                    <CheckCircle2
                      className="w-6 h-6 text-emerald-400 mx-auto"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-bold text-emerald-300">¡Bien!</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-rose-400">Fin</p>
                    <p className="font-mono text-sm font-bold text-slate-300 tabular-nums">
                      {score} pts
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column: Scoreboard, Live Status & Game Over Screen */}
          <section
            aria-label="Panel de estado y puntaje"
            className="lg:col-span-5 bg-[#101726] rounded-2xl border border-slate-800/90 p-5 sm:p-7 flex flex-col gap-6 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.65)]"
          >
            {/* Header Copy */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>Arcade de memoria</span>
                <span aria-hidden="true">·</span>
                <span>Luces y sonidos</span>
              </div>
              <h1
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white"
                style={{textWrap: 'balance'}}
              >
                Memoriza y repite la secuencia
              </h1>
            </div>

            {/* Scoreboard: Nivel / Puntaje actual & Récord máximo */}
            <div className="grid grid-cols-2 divide-x divide-slate-800 py-1">
              <div className="pr-4 space-y-1">
                <p className="text-xs font-medium text-slate-400">Nivel / Puntaje actual</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl sm:text-4xl font-bold text-white tabular-nums">
                    {phase === 'IDLE' ? 0 : currentLevel}
                  </span>
                  <span className="text-xs sm:text-sm font-mono text-slate-400 tabular-nums">
                    ({score} {score === 1 ? 'pto' : 'pts'})
                  </span>
                </div>
              </div>

              <div className="pl-5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Récord máximo</span>
                </div>
                <p className="font-display text-3xl sm:text-4xl font-bold text-amber-300 tabular-nums">
                  {highScore}
                  <span className="ml-1.5 text-xs sm:text-sm font-sans font-medium text-slate-400">
                    {highScore === 1 ? 'pto' : 'pts'}
                  </span>
                </p>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Dynamic Status / Game Over Panel */}
            <AnimatePresence mode="wait">
              {phase === 'GAME_OVER' ? (
                <motion.div
                  key="game-over-card"
                  initial={{opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -6}}
                  transition={{duration: 0.2}}
                  role="alert"
                  className="rounded-xl bg-rose-950/50 border border-rose-500/45 p-5 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="w-6 h-6 text-rose-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <h2 className="font-display text-xl font-bold text-white">
                        Fin del juego
                      </h2>
                      <p className="text-sm text-rose-100/90 leading-relaxed">
                        Alcanzaste el nivel <strong className="font-mono">{currentLevel}</strong>{' '}
                        con un puntaje de <strong className="font-mono">{score}</strong>.
                        {isNewRecord && score > 0 && (
                          <span className="block mt-1 text-amber-300 font-semibold">
                            ¡Superaste tu récord máximo!
                          </span>
                        )}
                      </p>
                      {mistakeInfo && (
                        <p className="text-xs text-rose-200/80 pt-1">
                          Presionaste <strong>{getPadLabel(mistakeInfo.pressed)}</strong> · El color
                          correcto era <strong>{getPadLabel(mistakeInfo.expected)}</strong>.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startNewGame}
                    className="w-full min-h-[54px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base sm:text-lg transition-all shadow-[0_0_28px_rgba(16,185,129,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>Jugar de nuevo</span>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={`status-${phase}`}
                  initial={{opacity: 0.7, y: 4}}
                  animate={{opacity: 1, y: 0}}
                  transition={{duration: 0.16}}
                  role="status"
                  aria-live="polite"
                  className="space-y-4"
                >
                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-2">
                    {phase === 'IDLE' && (
                      <>
                        <p className="text-sm sm:text-base font-semibold text-white">
                          Listo para comenzar
                        </p>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                          Toca cualquier color para probar su tono musical o presiona iniciar para
                          empezar la primera ronda.
                        </p>
                      </>
                    )}

                    {phase === 'SHOWING_SEQUENCE' && (
                      <>
                        <p className="text-sm sm:text-base font-semibold text-amber-300">
                          Observa con atención...
                        </p>
                        <p className="text-xs sm:text-sm text-slate-300">
                          Reproduciendo secuencia de {sequence.length}{' '}
                          {sequence.length === 1 ? 'color' : 'colores'}.
                        </p>
                      </>
                    )}

                    {phase === 'PLAYER_TURN' && (
                      <>
                        <p className="text-sm sm:text-base font-semibold text-emerald-400">
                          ¡Es tu turno!
                        </p>
                        <p className="text-xs sm:text-sm text-slate-300 font-mono tabular-nums">
                          Repite el orden: paso {playerIndex + 1} de {sequence.length}
                        </p>
                      </>
                    )}

                    {phase === 'ROUND_COMPLETE' && (
                      <>
                        <p className="text-sm sm:text-base font-semibold text-emerald-300">
                          ¡Secuencia completada!
                        </p>
                        <p className="text-xs sm:text-sm text-slate-300">
                          Preparando el nivel {sequence.length + 1}...
                        </p>
                      </>
                    )}
                  </div>

                  {phase === 'IDLE' && (
                    <button
                      type="button"
                      onClick={startNewGame}
                      className="w-full min-h-[52px] inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base transition-all shadow-[0_0_24px_rgba(16,185,129,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-current shrink-0" aria-hidden="true" />
                      <span>Comenzar partida</span>
                    </button>
                  )}

                  <p className="hidden sm:block text-xs text-slate-500 leading-relaxed">
                    Atajos de teclado: <span className="font-mono text-slate-400">1 / Q</span>{' '}
                    Verde · <span className="font-mono text-slate-400">2 / W</span> Rojo ·{' '}
                    <span className="font-mono text-slate-400">3 / A</span> Amarillo ·{' '}
                    <span className="font-mono text-slate-400">4 / S</span> Azul.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
    </MotionConfig>
  );
}
