import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Atom,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FastForward,
  FlaskConical,
  GraduationCap,
  Info,
  Maximize2,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  Trash2,
  Waves,
  Zap,
} from 'lucide-react';
import {
  Complex,
  CustomState,
  Gate,
  InitialState,
  SimulationPayload,
  SimulationResult,
  StateRecord,
  TomographyResult,
  computeBloch,
  exportCsv,
  formatInitialLabel,
  runTomography,
  simulate,
} from './quantum/engine';
import { exportPdf } from './quantum/pdfExport';

interface GateDef {
  symbol: string;
  name: string;
  category: 'pauli' | 'superposition' | 'rotation';
  desc: string;
  matrixLatex: string;
  cssClass: string;
}

const GATE_CATALOG: GateDef[] = [
  // Pauli group
  {
    symbol: 'X',
    name: 'Pauli-X',
    category: 'pauli',
    desc: 'Quantum NOT gate. Swaps |0⟩ ↔ |1⟩ by 180° rotation around the X axis.',
    matrixLatex: '[[0, 1], [1, 0]]',
    cssClass: 'gate-pauli-x',
  },
  {
    symbol: 'Y',
    name: 'Pauli-Y',
    category: 'pauli',
    desc: 'Bit and phase flip. Rotates 180° around the Y axis on the Bloch sphere.',
    matrixLatex: '[[0, -i], [i, 0]]',
    cssClass: 'gate-pauli-y',
  },
  {
    symbol: 'Z',
    name: 'Pauli-Z',
    category: 'pauli',
    desc: 'Phase flip gate. Leaves |0⟩ unchanged and maps |1⟩ to -|1⟩.',
    matrixLatex: '[[1, 0], [0, -1]]',
    cssClass: 'gate-pauli-z',
  },
  // Superposition & Phase
  {
    symbol: 'H',
    name: 'Hadamard',
    category: 'superposition',
    desc: 'Creates equal superpositions: maps |0⟩ → |+⟩ and |1⟩ → |−⟩.',
    matrixLatex: '1/√2 [[1, 1], [1, -1]]',
    cssClass: 'gate-hadamard',
  },
  {
    symbol: 'S',
    name: 'Phase (S)',
    category: 'superposition',
    desc: 'Square root of Z gate. Adds a π/2 (90°) relative phase to |1⟩.',
    matrixLatex: '[[1, 0], [0, i]]',
    cssClass: 'gate-phase-s',
  },
  {
    symbol: 'T',
    name: 'π/8 (T)',
    category: 'superposition',
    desc: 'Fourth root of Z gate. Adds a π/4 (45°) relative phase to |1⟩.',
    matrixLatex: '[[1, 0], [0, e^{iπ/4}]]',
    cssClass: 'gate-phase-t',
  },
  // Rotations
  {
    symbol: 'RX',
    name: 'Rotation X',
    category: 'rotation',
    desc: 'Continuous rotation around the X axis by arbitrary angle θ.',
    matrixLatex: '[[cos(θ/2), -i sin(θ/2)], [-i sin(θ/2), cos(θ/2)]]',
    cssClass: 'gate-rot-x',
  },
  {
    symbol: 'RY',
    name: 'Rotation Y',
    category: 'rotation',
    desc: 'Continuous rotation around the Y axis by arbitrary angle θ.',
    matrixLatex: '[[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]]',
    cssClass: 'gate-rot-y',
  },
  {
    symbol: 'RZ',
    name: 'Rotation Z',
    category: 'rotation',
    desc: 'Continuous rotation around the Z axis by arbitrary angle θ.',
    matrixLatex: '[[e^{-iθ/2}, 0], [0, e^{iθ/2}]]',
    cssClass: 'gate-rot-z',
  },
];

const TARGETS: [string, string][] = [
  ['0', '|0⟩ — North pole (+Z)'],
  ['1', '|1⟩ — South pole (-Z)'],
  ['+', '|+⟩ — Positive X axis'],
  ['-', '|−⟩ — Negative X axis'],
  ['+i', '|+i⟩ — Positive Y axis'],
  ['-i', '|−i⟩ — Negative Y axis'],
];

const QUIZ = [
  {
    q: 'What does a Hadamard (H) gate do to the ground state |0⟩?',
    opts: ['Inverts it directly into |1⟩', 'Creates an equal superposition (|0⟩ + |1⟩)/√2', 'Only shifts the unobservable global phase'],
    correct: 1,
    why: 'H|0⟩ = (|0⟩ + |1⟩)/√2 = |+⟩, giving an exact 50% probability for both 0 and 1.',
  },
  {
    q: 'Which single-qubit gate acts as the quantum NOT gate?',
    opts: ['Pauli-X', 'Pauli-Z', 'T gate'],
    correct: 0,
    why: 'Pauli-X swaps amplitudes between |0⟩ and |1⟩, acting as a quantum bit-flip.',
  },
  {
    q: 'What does state fidelity F = 1 mean for pure states?',
    opts: ['The states are orthogonal to each other', 'The states represent the identical physical quantum state', 'Both outcome probabilities are exactly 50%'],
    correct: 1,
    why: 'Pure state fidelity |⟨target|state⟩|² equals 1 when states match up to an unobservable global phase.',
  },
  {
    q: 'Which measurement bases are required for single-qubit quantum state tomography?',
    opts: ['Only the Z basis (computational)', 'X, Y, and Z bases together', 'Only X and Y bases'],
    correct: 1,
    why: 'Single-qubit density matrices require measuring expectation values along all three orthogonal axes.',
  },
  {
    q: 'What effect does an RZ rotation have on an equal superposition state |+⟩?',
    opts: ['Shifts the relative phase between |0⟩ and |1⟩', 'Changes the Z-basis probabilities', 'Entangles the qubit with the environment'],
    correct: 0,
    why: 'RZ rotates around the Z axis, modifying the relative phase along the equator while keeping P(0)=P(1)=0.5.',
  },
];

const CHALLENGES = [
  {
    title: 'Create an Equal Superposition',
    desc: 'Starting from ground state |0⟩, create a state with 50% probability for both 0 and 1.',
    initial: '0' as const,
    defaultGates: [{ name: 'H' }],
    test: (r: SimulationResult) => Math.abs(r.probabilities['0'] - 0.5) < 1e-4,
  },
  {
    title: 'Bit-Flip into Excited State',
    desc: 'Starting from |0⟩, rotate the qubit state completely into |1⟩.',
    initial: '0' as const,
    defaultGates: [{ name: 'X' }],
    test: (r: SimulationResult) => r.probabilities['1'] > 0.999,
  },
  {
    title: 'Self-Inverse Hadamard Cycle',
    desc: 'Verify that applying Hadamard twice returns the qubit back to its original state |0⟩.',
    initial: '0' as const,
    defaultGates: [{ name: 'H' }, { name: 'H' }],
    test: (r: SimulationResult) => r.probabilities['0'] > 0.999,
  },
  {
    title: 'Equatorial Phase Shift',
    desc: 'From |0⟩, create |+⟩ then apply S to reach |+i⟩ (along the +Y axis).',
    initial: '0' as const,
    defaultGates: [{ name: 'H' }, { name: 'S' }],
    test: (r: SimulationResult) => r.bloch.y > 0.99,
  },
];

function ctext(c: Complex): string {
  const re = Math.abs(c.real) < 1e-7 ? 0 : c.real;
  const im = Math.abs(c.imag) < 1e-7 ? 0 : c.imag;
  if (!im) return re.toFixed(3);
  if (!re) return `${im.toFixed(3)}i`;
  return `${re.toFixed(3)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(3)}i`;
}

function pct(x: number) {
  return `${(100 * Math.max(0, Math.min(1, x))).toFixed(1)}%`;
}

// 3D Bloch Sphere Component
function BlochSphere({
  vector,
  viewPreset,
  onResetView,
}: {
  vector: { x: number; y: number; z: number };
  viewPreset: { x: number; y: number };
  onResetView: (preset: { x: number; y: number }) => void;
}) {
  const [rot, setRot] = useState(viewPreset);
  const [drag, setDrag] = useState<{ x: number; y: number; rx: number; ry: number } | null>(null);

  useEffect(() => {
    setRot(viewPreset);
  }, [viewPreset]);

  const x = vector.x;
  const y = vector.y;
  const z = vector.z;

  const rx = (rot.x * Math.PI) / 180;
  const ry = (rot.y * Math.PI) / 180;

  // 3D rotation projection
  const yy = y * Math.cos(rx) - z * Math.sin(rx);
  const zz = y * Math.sin(rx) + z * Math.cos(rx);
  const xx = x * Math.cos(ry) + zz * Math.sin(ry);

  // Center is (200, 160), radius is 110
  const cx = 200;
  const cy = 160;
  const radius = 110;
  const px = cx + radius * xx;
  const py = cy - radius * yy;

  // Axis projection vectors
  const projectPoint = (ax: number, ay: number, az: number) => {
    const ayy = ay * Math.cos(rx) - az * Math.sin(rx);
    const azz = ay * Math.sin(rx) + az * Math.cos(rx);
    const axx = ax * Math.cos(ry) + azz * Math.sin(ry);
    return { x: cx + radius * axx, y: cy - radius * ayy };
  };

  const pZPlus = projectPoint(0, 0, 1.22);
  const pZMinus = projectPoint(0, 0, -1.22);
  const pXPlus = projectPoint(1.22, 0, 0);
  const pXMinus = projectPoint(-1.22, 0, 0);
  const pYPlus = projectPoint(0, 1.22, 0);
  const pYMinus = projectPoint(0, -1.22, 0);

  return (
    <div className="bloch-container">
      <div className="bloch-view-controls">
        <button
          className="view-preset-btn"
          onClick={() => onResetView({ x: -20, y: 35 })}
          title="Isometric perspective"
        >
          Isometric
        </button>
        <button
          className="view-preset-btn"
          onClick={() => onResetView({ x: -80, y: 0 })}
          title="View from Top (+Z)"
        >
          Top (+Z)
        </button>
        <button
          className="view-preset-btn"
          onClick={() => onResetView({ x: 0, y: 0 })}
          title="View from Front (+X)"
        >
          Front (+X)
        </button>
        <button
          className="view-preset-btn"
          onClick={() => onResetView({ x: 0, y: 90 })}
          title="View from Side (+Y)"
        >
          Side (+Y)
        </button>
      </div>

      <svg
        viewBox="0 0 400 320"
        className="bloch-svg-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y });
        }}
        onPointerMove={(e) => {
          if (drag) {
            setRot({
              x: Math.max(-85, Math.min(85, drag.rx + (e.clientY - drag.y) * 0.5)),
              y: drag.ry + (e.clientX - drag.x) * 0.6,
            });
          }
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <radialGradient id="sphereGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#0d1b2a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#080f1d" stopOpacity="0.8" />
          </radialGradient>
          <linearGradient id="vectorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Sphere Silhouette */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="url(#sphereGrad)"
          stroke="#263b5e"
          strokeWidth="1.5"
        />

        {/* Latitude Equator Ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={radius}
          ry={radius * Math.abs(Math.sin((rot.x * Math.PI) / 180))}
          fill="none"
          stroke="#334d75"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Longitude Meridian Ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={radius * Math.abs(Math.cos((rot.y * Math.PI) / 180))}
          ry={radius}
          fill="none"
          stroke="#334d75"
          strokeWidth="1"
          strokeDasharray="4 4"
          transform={`rotate(${rot.y} ${cx} ${cy})`}
        />

        {/* 3D Axes with Directional Colors */}
        {/* Z Axis: Sky Blue */}
        <line
          x1={projectPoint(0, 0, -1).x}
          y1={projectPoint(0, 0, -1).y}
          x2={projectPoint(0, 0, 1).x}
          y2={projectPoint(0, 0, 1).y}
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />
        {/* X Axis: Coral Rose */}
        <line
          x1={projectPoint(-1, 0, 0).x}
          y1={projectPoint(-1, 0, 0).y}
          x2={projectPoint(1, 0, 0).x}
          y2={projectPoint(1, 0, 0).y}
          stroke="#fb7185"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />
        {/* Y Axis: Emerald */}
        <line
          x1={projectPoint(0, -1, 0).x}
          y1={projectPoint(0, -1, 0).y}
          x2={projectPoint(0, 1, 0).x}
          y2={projectPoint(0, 1, 0).y}
          stroke="#34d399"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />

        {/* Basis State Labels */}
        <text x={pZPlus.x} y={pZPlus.y} fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="middle">
          |0⟩
        </text>
        <text x={pZMinus.x} y={pZMinus.y + 4} fill="#94a3b8" fontSize="11" textAnchor="middle">
          |1⟩
        </text>
        <text x={pXPlus.x + 4} y={pXPlus.y + 3} fill="#fb7185" fontSize="11" fontWeight="600">
          |+⟩ (+X)
        </text>
        <text x={pXMinus.x - 4} y={pXMinus.y + 3} fill="#f43f5e" fontSize="10" textAnchor="end">
          |−⟩
        </text>
        <text x={pYPlus.x} y={pYPlus.y - 4} fill="#34d399" fontSize="11" fontWeight="600" textAnchor="middle">
          |+i⟩ (+Y)
        </text>

        {/* Vector Line */}
        <line
          x1={cx}
          y1={cy}
          x2={px}
          y2={py}
          stroke="url(#vectorGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#neonGlow)"
        />

        {/* Center Point */}
        <circle cx={cx} cy={cy} r="3.5" fill="#94a3b8" />

        {/* Glowing Vector Head */}
        <circle
          cx={px}
          cy={py}
          r="7"
          fill="#fbbf24"
          stroke="#ffffff"
          strokeWidth="2"
          filter="url(#neonGlow)"
        />
      </svg>

      <div className="bloch-coords-strip">
        <div className="coord-cell">
          <span className="coord-axis axis-x">X axis</span>
          <span className="coord-value">{x >= 0 ? `+${x.toFixed(3)}` : x.toFixed(3)}</span>
        </div>
        <div className="coord-cell">
          <span className="coord-axis axis-y">Y axis</span>
          <span className="coord-value">{y >= 0 ? `+${y.toFixed(3)}` : y.toFixed(3)}</span>
        </div>
        <div className="coord-cell">
          <span className="coord-axis axis-z">Z axis</span>
          <span className="coord-value">{z >= 0 ? `+${z.toFixed(3)}` : z.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [alphaVal, setAlphaVal] = useState<number>(1.0);
  const [betaVal, setBetaVal] = useState<number>(0.0);
  const [betaSign, setBetaSign] = useState<number>(1);
  const [alphaInput, setAlphaInput] = useState<string>('1.000');
  const [betaInput, setBetaInput] = useState<string>('0.000');
  const [initial, setInitial] = useState<InitialState>({
    alpha_real: 1.0,
    alpha_imag: 0.0,
    beta_real: 0.0,
    beta_imag: 0.0,
  });

  const [gates, setGates] = useState<Gate[]>([]);
  const [redoStack, setRedoStack] = useState<Gate[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>('H');
  const [rotationAngle, setRotationAngle] = useState<number>(90);

  const [shots, setShots] = useState<number>(1000);
  const [target, setTarget] = useState<'0' | '1' | '+' | '-' | '+i' | '-i'>('+');

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [step, setStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(900);

  const [tomography, setTomography] = useState<TomographyResult | null>(null);
  const [viewPreset, setViewPreset] = useState<{ x: number; y: number }>({ x: -20, y: 35 });

  const [tab, setTab] = useState<'simulator' | 'learn'>('simulator');
  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [passedChallenges, setPassedChallenges] = useState<Record<number, boolean>>({});

  const payload: SimulationPayload = useMemo(
    () => ({
      initial_state: initial,
      gates,
      shots: Number(shots),
      target_state: target,
    }),
    [initial, gates, shots, target]
  );

  const executeSimulation = useCallback((p: SimulationPayload) => {
    try {
      const res = simulate(p);
      setResult(res);
      setStep(res.history.length - 1);
      return res;
    } catch (err: any) {
      setError(`Simulation error: ${err.message}`);
      return null;
    }
  }, []);

  useEffect(() => {
    executeSimulation({
      initial_state: '0',
      gates: [],
      shots: 1000,
      target_state: '+',
    });
  }, [executeSimulation]);

  // Automated playback
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setStep((curr) => {
        const max = (result?.history?.length || 1) - 1;
        if (curr >= max) {
          setIsPlaying(false);
          return max;
        }
        return curr + 1;
      });
    }, playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, result, playbackSpeed]);

  // Active step record (bug-free synchronization)
  const currentRecord: StateRecord | undefined =
    result?.history?.[Math.min(step, (result?.history?.length || 1) - 1)] ||
    result?.history?.[0];

  const currentBloch = currentRecord ? currentRecord.bloch : { x: 0, y: 0, z: 1 };
  const currentProbs = currentRecord ? currentRecord.probabilities : { '0': 1, '1': 0 };
  const currentFidelity = currentRecord ? currentRecord.fidelity : 0;
  const currentPhase = currentRecord?.relative_phase_degrees ?? null;

  // Selected gate metadata
  const activeGateDef = GATE_CATALOG.find((g) => g.symbol === selectedGate) || GATE_CATALOG[3];

  // Actions
  function addGateToCircuit(gateSymbol: string, angleVal?: number) {
    const isRot = gateSymbol.startsWith('R');
    const newGate: Gate = {
      name: gateSymbol,
      ...(isRot ? { angle: angleVal ?? rotationAngle } : {}),
    };
    const next = [...gates, newGate];
    setGates(next);
    setRedoStack([]);
    setTomography(null);
    executeSimulation({ ...payload, gates: next });
  }

  function removeGateAtIndex(index: number) {
    const next = gates.filter((_, idx) => idx !== index);
    setGates(next);
    setRedoStack([]);
    setTomography(null);
    executeSimulation({ ...payload, gates: next });
  }

  function handleUndo() {
    if (!gates.length) return;
    const last = gates[gates.length - 1];
    const next = gates.slice(0, -1);
    setGates(next);
    setRedoStack((prev) => [last, ...prev]);
    setTomography(null);
    setIsPlaying(false);
    executeSimulation({ ...payload, gates: next });
  }

  function handleRedo() {
    if (!redoStack.length) return;
    const [first, ...rest] = redoStack;
    const next = [...gates, first];
    setGates(next);
    setRedoStack(rest);
    setTomography(null);
    executeSimulation({ ...payload, gates: next });
  }

  function handleResetCircuit() {
    setIsPlaying(false);
    setGates([]);
    setRedoStack([]);
    setStep(0);
    setTomography(null);
    executeSimulation({ ...payload, gates: [] });
  }

  const applyStateSimultaneous = useCallback(
    (a: number, bSign: number, source?: 'alpha' | 'beta') => {
      const clampedA = Math.max(0, Math.min(1, a));
      const bMag = Math.sqrt(Math.max(0, 1 - clampedA * clampedA));
      const bSigned = bMag * bSign;

      setAlphaVal(clampedA);
      setBetaVal(bMag);
      setBetaSign(bSign);

      if (source !== 'alpha') {
        setAlphaInput(clampedA.toFixed(3));
      }
      if (source !== 'beta') {
        setBetaInput(bMag.toFixed(3));
      }

      const customState: CustomState = {
        alpha_real: clampedA,
        alpha_imag: 0,
        beta_real: bSigned,
        beta_imag: 0,
      };
      setInitial(customState);
      executeSimulation({ ...payload, initial_state: customState });
    },
    [payload, executeSimulation]
  );

  const handleAlphaChange = useCallback(
    (rawVal: string) => {
      setAlphaInput(rawVal);
      const parsedA = parseFloat(rawVal);
      if (!isNaN(parsedA) && parsedA >= 0 && parsedA <= 1) {
        const computedB = Math.sqrt(Math.max(0, 1 - parsedA * parsedA));
        setAlphaVal(parsedA);
        setBetaVal(computedB);
        setBetaInput(computedB.toFixed(3));

        const customState: CustomState = {
          alpha_real: parsedA,
          alpha_imag: 0,
          beta_real: computedB * betaSign,
          beta_imag: 0,
        };
        setInitial(customState);
        executeSimulation({ ...payload, initial_state: customState });
      }
    },
    [betaSign, payload, executeSimulation]
  );

  const handleBetaChange = useCallback(
    (rawVal: string) => {
      setBetaInput(rawVal);
      const parsedB = parseFloat(rawVal);
      if (!isNaN(parsedB) && parsedB >= 0 && parsedB <= 1) {
        const computedA = Math.sqrt(Math.max(0, 1 - parsedB * parsedB));
        setBetaVal(parsedB);
        setAlphaVal(computedA);
        setAlphaInput(computedA.toFixed(3));

        const customState: CustomState = {
          alpha_real: computedA,
          alpha_imag: 0,
          beta_real: parsedB * betaSign,
          beta_imag: 0,
        };
        setInitial(customState);
        executeSimulation({ ...payload, initial_state: customState });
      }
    },
    [betaSign, payload, executeSimulation]
  );

  const handleSliderChange = useCallback(
    (newA: number) => {
      applyStateSimultaneous(newA, betaSign);
    },
    [applyStateSimultaneous, betaSign]
  );

  const stepAlpha = useCallback(
    (delta: number) => {
      const nextA = Math.max(0, Math.min(1, Number((alphaVal + delta).toFixed(3))));
      applyStateSimultaneous(nextA, betaSign);
    },
    [alphaVal, betaSign, applyStateSimultaneous]
  );

  const stepBeta = useCallback(
    (delta: number) => {
      const nextB = Math.max(0, Math.min(1, Number((betaVal + delta).toFixed(3))));
      const nextA = Math.sqrt(Math.max(0, 1 - nextB * nextB));
      applyStateSimultaneous(nextA, betaSign);
    },
    [betaVal, betaSign, applyStateSimultaneous]
  );

  const toggleBetaSign = useCallback(() => {
    const nextSign = betaSign === 1 ? -1 : 1;
    applyStateSimultaneous(alphaVal, nextSign);
  }, [betaSign, alphaVal, applyStateSimultaneous]);

  const setPresetState = useCallback(
    (a: number, b: number, sign: number = 1) => {
      applyStateSimultaneous(a, sign);
    },
    [applyStateSimultaneous]
  );

  function runFiniteShotExperiment() {
    executeSimulation(payload);
    setNotice(`Simulated ${shots.toLocaleString()} measurement shots using Born rule.`);
  }

  function runTomographyAnalysis() {
    try {
      const data = runTomography(payload);
      setTomography(data);
      setNotice('Quantum state tomography reconstructed density matrix.');
    } catch (e: any) {
      setError(e.message);
    }
  }

  function exportReport(type: 'csv' | 'pdf') {
    if (!result) return;
    try {
      if (type === 'csv') {
        const text = exportCsv(payload, result);
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qubitlab-experiment.csv';
        a.click();
        URL.revokeObjectURL(url);
        setNotice('CSV experiment report exported.');
      } else {
        exportPdf(payload, result);
        setNotice('PDF experiment report exported.');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  function loadChallenge(idx: number) {
    const item = CHALLENGES[idx];
    setTab('simulator');
    setPresetState(1.0, 0.0, 1);
    setGates(item.defaultGates);
    setRedoStack([]);
    setTomography(null);
    const res = executeSimulation({
      ...payload,
      initial_state: { alpha_real: 1, alpha_imag: 0, beta_real: 0, beta_imag: 0 },
      gates: item.defaultGates,
    });
    if (res) {
      setPassedChallenges((prev) => ({ ...prev, [idx]: item.test(res) }));
    }
    setNotice(`Loaded Challenge: "${item.title}". Test condition evaluated.`);
  }

  const alphaFormula = alphaVal.toFixed(3);
  const betaFormula = betaVal.toFixed(3);

  const quizScore = QUIZ.filter((q, i) => answers[i] === q.correct).length;

  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Atom size={22} />
          </div>
          <div>
            <div className="brand-name">
              Qubit<span>Lab</span>
            </div>
            <div className="brand-caption">QUANTUM GATE SIMULATOR</div>
          </div>
        </div>

        <nav className="top-nav">
          <button
            className={`nav-link ${tab === 'simulator' ? 'active' : ''}`}
            onClick={() => setTab('simulator')}
          >
            <Zap size={16} /> Quantum Studio
          </button>
          <button
            className={`nav-link ${tab === 'learn' ? 'active' : ''}`}
            onClick={() => setTab('learn')}
          >
            <GraduationCap size={16} /> Academy & Challenges
          </button>
        </nav>

        <div className="engine-status">
          <span className="live-dot" />
          <span>REAL-TIME ENGINE</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            <span>Interactive State Engine</span>
          </div>
          <h1>
            One Qubit. <span>Infinite Quantum Possibilities.</span>
          </h1>
          <p>
            Build gate circuits on the quantum wire, observe real-time 3D Bloch sphere vector rotations,
            simulate finite-shot measurements, and reconstruct the density matrix via state tomography.
          </p>
          <div className="hero-tags">
            <span className="tag-item">
              <Waves size={14} /> 3D Bloch Sphere
            </span>
            <span className="tag-item">
              <Zap size={14} /> 9 Standard Gates
            </span>
            <span className="tag-item">
              <FlaskConical size={14} /> State Tomography
            </span>
            <span className="tag-item">
              <Activity size={14} /> Born Rule Sampling
            </span>
          </div>
        </section>

        {/* Notifications */}
        {error && (
          <div className="notification-banner error">
            <Info size={16} />
            <span>{error}</span>
            <button style={{ marginLeft: 'auto' }} onClick={() => setError('')}>
              ✕
            </button>
          </div>
        )}
        {notice && (
          <div className="notification-banner success" onClick={() => setNotice('')}>
            <Check size={16} />
            <span>{notice}</span>
            <button style={{ marginLeft: 'auto' }} onClick={() => setNotice('')}>
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Simulator View */}
        {tab === 'simulator' && (
          <>
            {/* Horizontal Quantum Wire Canvas */}
            <section className="circuit-board">
              <div className="circuit-header">
                <div>
                  <div className="panel-kicker">CIRCUIT WIRE</div>
                  <h2 style={{ fontSize: '16px', fontWeight: '750' }}>Quantum Circuit Rail</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="secondary-btn"
                    onClick={handleUndo}
                    disabled={!gates.length}
                    title="Undo gate"
                  >
                    <RotateCcw size={14} /> Undo
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={handleRedo}
                    disabled={!redoStack.length}
                    title="Redo gate"
                  >
                    <RotateCw size={14} /> Redo
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={handleResetCircuit}
                    disabled={!gates.length}
                    title="Clear circuit wire"
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                </div>
              </div>

              <div className="circuit-track">
                <div className="circuit-wire-line" />
                <div className="qubit-label">
                  |q₀⟩ : {typeof initial === 'string' ? `|${initial}⟩` : '|ψ₀⟩'}
                </div>

                {!gates.length ? (
                  <span className="empty-wire-notice">
                    Circuit is currently empty. Click any gate below to add it to the wire.
                  </span>
                ) : (
                  gates.map((g, idx) => {
                    const isStepCurrent = step === idx + 1;
                    const gateMeta = GATE_CATALOG.find((m) => m.symbol === g.name);
                    return (
                      <div
                        key={`${g.name}-${idx}`}
                        className={`circuit-gate-tile ${gateMeta?.cssClass || ''} ${
                          isStepCurrent ? 'current-step' : ''
                        }`}
                        onClick={() => {
                          setIsPlaying(false);
                          setStep(idx + 1);
                        }}
                        title={`Step ${idx + 1}: ${g.name} (Click to inspect)`}
                      >
                        <span>{g.name}</span>
                        {g.angle !== undefined && <small>{g.angle}°</small>}
                        <button
                          className="remove-gate-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeGateAtIndex(idx);
                          }}
                          title="Remove gate"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Main Interactive Studio Grid */}
            <div className="workspace">
              {/* Left Column: Gate Controls & Initial State */}
              <aside className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">EXPERIMENT CONTROLS</div>
                    <h2>Gate Palette</h2>
                  </div>
                  <div className="heading-icon">
                    <Sliders size={18} />
                  </div>
                </div>

                {/* Initial State Equation Builder & Flexible Coefficients */}
                <div className="state-selector-group">
                  <div className="equation-card">
                    <div className="equation-header">
                      <div className="panel-kicker">EQUATION BUILDER</div>
                      <span className="qubit-label" style={{ fontSize: '11px' }}>
                        |ψ₀⟩ = α|0⟩ + β|1⟩
                      </span>
                    </div>

                    {/* Live Equation Readout */}
                    <div className="equation-formula-display">
                      <span className="equation-symbol">|ψ₀⟩ =</span>
                      <span className="coeff-badge-alpha" title="Alpha coefficient: amplitude of |0⟩">
                        {alphaFormula} |0⟩
                      </span>
                      <span className="equation-symbol">{betaSign < 0 ? '−' : '+'}</span>
                      <span className="coeff-badge-beta" title="Beta coefficient: amplitude of |1⟩">
                        {betaFormula} |1⟩
                      </span>
                    </div>

                    {/* Quick State Presets */}
                    <div className="preset-pills" style={{ marginBottom: '14px' }}>
                      <button
                        className={`preset-pill-btn ${alphaVal > 0.99 ? 'selected' : ''}`}
                        onClick={() => setPresetState(1.0, 0.0, 1)}
                        title="|0⟩ Ground state (α=1, β=0)"
                      >
                        |0⟩ Ground
                      </button>
                      <button
                        className={`preset-pill-btn ${betaVal > 0.99 ? 'selected' : ''}`}
                        onClick={() => setPresetState(0.0, 1.0, 1)}
                        title="|1⟩ Excited state (α=0, β=1)"
                      >
                        |1⟩ Excited
                      </button>
                      <button
                        className={`preset-pill-btn ${Math.abs(alphaVal - 0.7071) < 0.02 && betaSign === 1 ? 'selected' : ''}`}
                        onClick={() => setPresetState(Math.SQRT1_2, Math.SQRT1_2, 1)}
                        title="|+⟩ Equal Superposition (α=0.707, β=+0.707)"
                      >
                        |+⟩ Superpos
                      </button>
                      <button
                        className={`preset-pill-btn ${Math.abs(alphaVal - 0.7071) < 0.02 && betaSign === -1 ? 'selected' : ''}`}
                        onClick={() => setPresetState(Math.SQRT1_2, Math.SQRT1_2, -1)}
                        title="|−⟩ Phase Inverted (α=0.707, β=−0.707)"
                      >
                        |−⟩ Inverted
                      </button>
                      <button
                        className={`preset-pill-btn ${Math.abs(alphaVal - 0.866) < 0.02 ? 'selected' : ''}`}
                        onClick={() => setPresetState(0.866, 0.5, 1)}
                        title="|30°⟩ Superposition (α=0.866, β=0.500)"
                      >
                        |30°⟩ State
                      </button>
                      <button
                        className={`preset-pill-btn ${Math.abs(alphaVal - 0.5) < 0.02 ? 'selected' : ''}`}
                        onClick={() => setPresetState(0.5, 0.866, 1)}
                        title="|60°⟩ Superposition (α=0.500, β=0.866)"
                      >
                        |60°⟩ State
                      </button>
                    </div>

                    {/* Numeric Amplitudes with Simultaneous Updating */}
                    <div className="amplitude-card">
                      <div className="amplitude-input-row">
                        {/* Alpha Coefficient Row */}
                        <div className="amplitude-field">
                          <label htmlFor="alpha-num-input" className="amplitude-field-header-alpha">
                            <span>Coefficient α (for |0⟩)</span>
                            <span className="prob-badge prob-badge-alpha">
                              P(0) = {(100 * alphaVal * alphaVal).toFixed(1)}%
                            </span>
                          </label>
                          <div className="amplitude-input-wrapper">
                            <button
                              type="button"
                              className="amplitude-step-btn"
                              onClick={() => stepAlpha(-0.05)}
                              disabled={alphaVal <= 0.001}
                              title="Decrease α by 0.05"
                            >
                              −
                            </button>
                            <input
                              id="alpha-num-input"
                              type="text"
                              inputMode="decimal"
                              value={alphaInput}
                              onChange={(e) => handleAlphaChange(e.target.value)}
                              placeholder="0.000"
                              autoComplete="off"
                              spellCheck="false"
                              style={{ backgroundColor: '#070e1c', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                            />
                            <button
                              type="button"
                              className="amplitude-step-btn"
                              onClick={() => stepAlpha(0.05)}
                              disabled={alphaVal >= 0.999}
                              title="Increase α by 0.05"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Beta Coefficient Row */}
                        <div className="amplitude-field">
                          <label htmlFor="beta-num-input" className="amplitude-field-header-beta">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>Coefficient β (for |1⟩)</span>
                              <button
                                type="button"
                                className={`sign-toggle-btn ${betaSign === 1 ? 'plus' : 'minus'}`}
                                onClick={toggleBetaSign}
                                title={`Toggle sign: Currently ${betaSign === 1 ? '+ positive' : '− negative'}`}
                              >
                                {betaSign === 1 ? '+ sign' : '− sign'}
                              </button>
                            </span>
                            <span className="prob-badge prob-badge-beta">
                              P(1) = {(100 * betaVal * betaVal).toFixed(1)}%
                            </span>
                          </label>
                          <div className="amplitude-input-wrapper">
                            <button
                              type="button"
                              className="amplitude-step-btn"
                              onClick={() => stepBeta(-0.05)}
                              disabled={betaVal <= 0.001}
                              title="Decrease β by 0.05"
                            >
                              −
                            </button>
                            <input
                              id="beta-num-input"
                              type="text"
                              inputMode="decimal"
                              value={betaInput}
                              onChange={(e) => handleBetaChange(e.target.value)}
                              placeholder="0.000"
                              autoComplete="off"
                              spellCheck="false"
                              style={{ backgroundColor: '#070e1c', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                            />
                            <button
                              type="button"
                              className="amplitude-step-btn"
                              onClick={() => stepBeta(0.05)}
                              disabled={betaVal >= 0.999}
                              title="Increase β by 0.05"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Simultaneous Balance Slider */}
                      <div className="simul-slider-box">
                        <div className="simul-slider-header">
                          <span>
                            State Balance: α = <strong>{alphaVal.toFixed(3)}</strong>
                          </span>
                          <span className="beta-val">
                            β = <strong>{betaSign < 0 ? `−${betaVal.toFixed(3)}` : `+${betaVal.toFixed(3)}`}</strong>
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.005"
                          className="angle-slider"
                          value={alphaVal}
                          onChange={(e) => handleSliderChange(+e.target.value)}
                          title="Slide α; β simultaneously auto-updates via β = √(1 - α²)"
                        />
                        <div className="simul-slider-legend">
                          <span>|1⟩ Pure (α=0)</span>
                          <span>Equal (α=0.707)</span>
                          <span>|0⟩ Pure (α=1)</span>
                        </div>
                      </div>
                    </div>

                    {/* Normalization Status Footer */}
                    <div className="norm-status-bar">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span>
                          Born Prob: P(0) = {(100 * alphaVal * alphaVal).toFixed(1)}% · P(1) = {(100 * betaVal * betaVal).toFixed(1)}%
                        </span>
                        <span className="norm-val">|α|² + |β|² = 1.000 (Normalized ✓)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gate Palette Grid */}
                <div className="gate-section-title">
                  <span>Standard Quantum Gates</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                    Selected: {activeGateDef.name}
                  </span>
                </div>

                <div className="gate-grid">
                  {GATE_CATALOG.map((g) => {
                    const isSelected = selectedGate === g.symbol;
                    return (
                      <button
                        key={g.symbol}
                        className={`gate-card-btn ${g.cssClass} ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedGate(g.symbol)}
                        onDoubleClick={() => addGateToCircuit(g.symbol)}
                        title={`Click to select, double-click to add ${g.name}`}
                      >
                        <div className="gate-badge-symbol">{g.symbol}</div>
                        <span className="gate-badge-name">{g.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Continuous Rotation Angle Knob/Slider */}
                {selectedGate.startsWith('R') && (
                  <div className="angle-box">
                    <div className="angle-row">
                      <span style={{ fontSize: '11px', fontWeight: '600' }}>
                        Rotation Angle (θ)
                      </span>
                      <span className="angle-readout">{rotationAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="-360"
                      max="360"
                      step="1"
                      className="angle-slider"
                      value={rotationAngle}
                      onChange={(e) => setRotationAngle(+e.target.value)}
                    />
                    <div className="angle-quick-chips">
                      {[30, 45, 60, 90, 180, 270, 360].map((deg) => (
                        <button
                          key={deg}
                          className={`angle-chip ${rotationAngle === deg ? 'selected' : ''}`}
                          onClick={() => setRotationAngle(deg)}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gate Explanation Card */}
                <div
                  style={{
                    margin: '14px 0',
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#090e1b',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Sparkles size={14} color="var(--color-cyan)" />
                    <strong style={{ fontSize: '12px' }}>{activeGateDef.name}</strong>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {activeGateDef.desc}
                  </p>
                  <code
                    style={{
                      display: 'block',
                      marginTop: '6px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-cyan)',
                    }}
                  >
                    Matrix: {activeGateDef.matrixLatex}
                  </code>
                </div>

                <button
                  className="primary-btn"
                  onClick={() => addGateToCircuit(selectedGate)}
                  disabled={gates.length >= 64}
                >
                  <Plus size={16} /> Add {activeGateDef.symbol} to Circuit
                </button>
              </aside>

              {/* Right Column: 3D Bloch Sphere & Step Execution */}
              <div className="visual-column">
                {/* 3D Bloch Sphere */}
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-kicker">GEOMETRIC STATE REPRESENTATION</div>
                      <h2>3D Bloch Sphere</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="engine-status" style={{ fontSize: '10px' }}>
                        LIVE VECTOR
                      </span>
                    </div>
                  </div>

                  <BlochSphere
                    vector={currentBloch}
                    viewPreset={viewPreset}
                    onResetView={(preset) => setViewPreset(preset)}
                  />
                </section>

                {/* Step Playback Controller */}
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-kicker">CIRCUIT PLAYBACK & SCRUBBER</div>
                      <h2>{currentRecord?.label || 'Initial State'}</h2>
                    </div>
                    <span className="qubit-label" style={{ fontSize: '11px' }}>
                      Step {step} / {Math.max(0, (result?.history?.length || 1) - 1)}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, (result?.history?.length || 1) - 1)}
                    value={step}
                    className="step-range-slider"
                    onChange={(e) => {
                      setIsPlaying(false);
                      setStep(+e.target.value);
                    }}
                  />

                  <div className="playback-bar">
                    <button
                      className="playback-icon-btn"
                      onClick={() => {
                        setIsPlaying(false);
                        setStep(0);
                      }}
                      title="First step"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="playback-icon-btn"
                      onClick={() => {
                        setIsPlaying(false);
                        setStep((s) => Math.max(0, s - 1));
                      }}
                      title="Previous step"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className="play-pause-btn"
                      onClick={() => {
                        if (step >= (result?.history?.length || 1) - 1) setStep(0);
                        setIsPlaying((p) => !p);
                      }}
                    >
                      <Play size={14} />
                      <span>{isPlaying ? 'Pause' : 'Play Circuit'}</span>
                    </button>
                    <button
                      className="playback-icon-btn"
                      onClick={() => {
                        setIsPlaying(false);
                        setStep((s) => Math.min((result?.history?.length || 1) - 1, s + 1));
                      }}
                      title="Next step"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      className="playback-icon-btn"
                      onClick={() => {
                        setIsPlaying(false);
                        setStep(Math.max(0, (result?.history?.length || 1) - 1));
                      }}
                      title="Last step"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      className="preset-pill-btn"
                      onClick={() => setPlaybackSpeed((s) => (s === 900 ? 450 : 900))}
                      title="Toggle speed"
                      style={{ marginLeft: '6px' }}
                    >
                      {playbackSpeed === 450 ? 'Speed: 2x' : 'Speed: 1x'}
                    </button>
                  </div>

                  {currentRecord && (
                    <div className="step-state-display">
                      <div className="state-amplitude-card">
                        <span>Amplitude α (|0⟩ component)</span>
                        <strong>{ctext(currentRecord.alpha)}</strong>
                      </div>
                      <div className="state-amplitude-card">
                        <span>Amplitude β (|1⟩ component)</span>
                        <strong>{ctext(currentRecord.beta)}</strong>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Metrics & Analysis Row */}
            <section className="metrics-row">
              {/* Born Rule Probability */}
              <article className="panel metric-card">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">BORN RULE</div>
                    <h2>Probability Distribution</h2>
                  </div>
                  <Activity size={18} color="var(--color-cyan)" />
                </div>

                <div className="prob-card-item">
                  <div className="prob-card-meta">
                    <span className="prob-basis-label">
                      <i className="prob-indicator-dot dot-0" /> |0⟩ Ground State
                    </span>
                    <span className="prob-percentage">{pct(currentProbs['0'])}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill fill-0"
                      style={{ width: pct(currentProbs['0']) }}
                    />
                  </div>
                </div>

                <div className="prob-card-item">
                  <div className="prob-card-meta">
                    <span className="prob-basis-label">
                      <i className="prob-indicator-dot dot-1" /> |1⟩ Excited State
                    </span>
                    <span className="prob-percentage">{pct(currentProbs['1'])}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill fill-1"
                      style={{ width: pct(currentProbs['1']) }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span>P(0) = |α|²</span>
                  <span>P(1) = |β|²</span>
                </div>
              </article>

              {/* State Fidelity & Relative Phase */}
              <article className="panel metric-card">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">TARGET COMPARISON</div>
                    <h2>Fidelity & Relative Phase</h2>
                  </div>
                  <Check size={18} color="var(--color-violet)" />
                </div>

                <label
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    marginBottom: '6px',
                    display: 'block',
                  }}
                >
                  COMPARE WITH TARGET STATE
                </label>
                <select
                  className="select-target-box"
                  value={target}
                  onChange={(e) => {
                    const newT = e.target.value as any;
                    setTarget(newT);
                    executeSimulation({ ...payload, target_state: newT });
                  }}
                >
                  {TARGETS.map((t) => (
                    <option key={t[0]} value={t[0]}>
                      {t[1]}
                    </option>
                  ))}
                </select>

                <div className="fidelity-hero">
                  <div className="fidelity-score-number">{pct(currentFidelity)}</div>
                  <span>State Fidelity F = |⟨target|ψ⟩|²</span>
                </div>

                <div className="progress-track" style={{ marginBottom: '14px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: pct(currentFidelity),
                      background: 'linear-gradient(90deg, #38bdf8, #a78bfa)',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Relative Phase:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyan)' }}>
                    {currentPhase !== null ? `${currentPhase}°` : 'Undefined (|0⟩ or |1⟩)'}
                  </strong>
                </div>
              </article>

              {/* Finite-Shot Measurement Lab */}
              <article className="panel metric-card">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">FINITE-SHOT SAMPLING</div>
                    <h2>Measurement Lab</h2>
                  </div>
                  <FlaskConical size={18} color="var(--color-emerald)" />
                </div>

                <label
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    marginBottom: '6px',
                    display: 'block',
                  }}
                >
                  NUMBER OF RUN SHOTS
                </label>
                <select
                  className="select-target-box"
                  value={shots}
                  onChange={(e) => setShots(+e.target.value)}
                >
                  <option value={100}>100 shots (High variance)</option>
                  <option value={1000}>1,000 shots (Standard)</option>
                  <option value={10000}>10,000 shots (Precision)</option>
                  <option value={100000}>100,000 shots (Ultra precision)</option>
                </select>

                <button className="primary-btn" onClick={runFiniteShotExperiment}>
                  <Play size={14} /> Run Measurement Shots
                </button>

                <div className="measurement-counts-box">
                  <div className="count-stat-card">
                    <span>Outcome |0⟩</span>
                    <strong>{result?.measurement?.counts?.['0']?.toLocaleString() ?? '—'}</strong>
                    <small>
                      Freq: {result ? pct(result.measurement.frequencies['0']) : '—'}
                    </small>
                  </div>
                  <div className="count-stat-card">
                    <span>Outcome |1⟩</span>
                    <strong>{result?.measurement?.counts?.['1']?.toLocaleString() ?? '—'}</strong>
                    <small>
                      Freq: {result ? pct(result.measurement.frequencies['1']) : '—'}
                    </small>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    textAlign: 'center',
                    marginTop: '4px',
                  }}
                >
                  Empirical frequencies converge toward Born rule probabilities as shots increase.
                </div>
              </article>
            </section>

            {/* Bottom Advanced Grid: Tomography & Export */}
            <section className="bottom-grid">
              {/* Quantum State Tomography */}
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">QUANTUM TOMOGRAPHY</div>
                    <h2>State Tomography & Density Matrix (ρ)</h2>
                  </div>
                  <Waves size={18} color="var(--color-cyan)" />
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Reconstructs the full quantum state density matrix ρ by performing finite-shot Pauli
                  measurements along the orthogonal X, Y, and Z bases: ρ = ½(I + ⟨σ_x⟩X + ⟨σ_y⟩Y + ⟨σ_z⟩Z).
                </p>

                <button className="primary-btn" onClick={runTomographyAnalysis} style={{ maxWidth: '240px' }}>
                  <FlaskConical size={14} /> Reconstruct Density Matrix
                </button>

                {tomography && (
                  <>
                    <div className="tomography-table">
                      <div className="tomography-row header-row">
                        <span>Basis</span>
                        <span>+1 Counts</span>
                        <span>−1 Counts</span>
                        <span>Estimated ⟨σ⟩</span>
                      </div>
                      {tomography.measurements.map((m) => (
                        <div className="tomography-row" key={m.basis}>
                          <strong style={{ color: 'var(--color-cyan)' }}>{m.basis} axis</strong>
                          <span>{m.plus.toLocaleString()}</span>
                          <span>{m.minus.toLocaleString()}</span>
                          <strong style={{ color: '#fff' }}>
                            {m.estimated_expectation >= 0 ? `+${m.estimated_expectation}` : m.estimated_expectation}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="density-matrix-wrapper">
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '10px' }}>
                        RECONSTRUCTED DENSITY MATRIX ρ = [[ρ₀₀, ρ₀₁], [ρ₁₀, ρ₁₁]]
                      </div>
                      <div className="matrix-content-grid">
                        {tomography.density_matrix_real_imag.map((row, rIdx) =>
                          row.map((cell, cIdx) => (
                            <div className="matrix-element" key={`${rIdx}-${cIdx}`}>
                              <span style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'block' }}>
                                ρ_{rIdx}{cIdx}
                              </span>
                              <strong>
                                {cell[0].toFixed(3)}
                                {cell[1] < 0 ? ` − ${Math.abs(cell[1]).toFixed(3)}i` : ` + ${cell[1].toFixed(3)}i`}
                              </strong>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </article>

              {/* Save & Export */}
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">EXPORT CENTER</div>
                    <h2>Experiment Reports</h2>
                  </div>
                  <Download size={18} color="var(--color-emerald)" />
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Save your quantum circuit parameters, step evolution records, Born probabilities, and
                  tomography results.
                </p>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <button className="primary-btn" onClick={() => exportReport('csv')}>
                    <Download size={15} /> Export CSV Experiment Data
                  </button>
                  <button className="secondary-btn" onClick={() => exportReport('pdf')}>
                    <Download size={15} /> Generate Printable PDF Report
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '20px',
                    fontSize: '11px',
                    color: 'var(--color-emerald)',
                  }}
                >
                  <Check size={14} /> Full step history and analytical verification included.
                </div>
              </article>
            </section>
          </>
        )}

        {/* Tab 2: Academy & Challenges */}
        {tab === 'learn' && (
          <section className="learn-grid">
            {/* Interactive Quizzes */}
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">KNOWLEDGE CHECK</div>
                  <h2>Quantum Mechanics & Gates Quiz</h2>
                </div>
                <span className="qubit-label">
                  Score: {quizScore} / {QUIZ.length}
                </span>
              </div>

              <div>
                {QUIZ.map((q, qIdx) => {
                  const userAnswer = answers[qIdx];
                  const hasAnswered = userAnswer !== undefined;
                  const isCorrect = userAnswer === q.correct;
                  return (
                    <div className="quiz-card" key={q.q}>
                      <div className="quiz-question-title">
                        {qIdx + 1}. {q.q}
                      </div>
                      <div className="quiz-choices">
                        {q.opts.map((opt, oIdx) => {
                          let choiceClass = '';
                          if (hasAnswered) {
                            if (oIdx === q.correct) choiceClass = 'correct';
                            else if (userAnswer === oIdx) choiceClass = 'incorrect';
                          }
                          return (
                            <button
                              key={opt}
                              className={`quiz-choice-btn ${choiceClass}`}
                              onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                            >
                              <strong style={{ fontFamily: 'var(--font-mono)' }}>
                                {String.fromCharCode(65 + oIdx)}.
                              </strong>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {hasAnswered && (
                        <div className="quiz-explanation-box">
                          <strong>{isCorrect ? 'Correct! ' : 'Explanation: '}</strong>
                          <span>{q.why}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                className="secondary-btn"
                style={{ marginTop: '16px' }}
                onClick={() => setAnswers({})}
              >
                <RotateCcw size={14} /> Reset Quiz Answers
              </button>
            </div>

            {/* Guided Gate Challenges */}
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">PRACTICE ARENA</div>
                  <h2>Guided Quantum Challenges</h2>
                </div>
                <Sparkles size={18} color="var(--color-amber)" />
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Load challenge configurations directly into the simulator to test your intuition on quantum state
                transformations.
              </p>

              <div>
                {CHALLENGES.map((ch, idx) => {
                  const isPassed = passedChallenges[idx];
                  return (
                    <div className="challenge-item" key={ch.title}>
                      <div className="challenge-meta">
                        <strong>{ch.title}</strong>
                        <p>{ch.desc}</p>
                        {isPassed && (
                          <div className="passed-tag">
                            <Check size={14} /> Challenge Completed
                          </div>
                        )}
                      </div>
                      <button className="primary-btn" style={{ minWidth: '150px' }} onClick={() => loadChallenge(idx)}>
                        Load Challenge
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer>
          <div className="footer-brand">
            <Atom size={18} color="var(--color-cyan)" />
            <span>QubitLab — Quantum Gate Simulator</span>
          </div>
          <span>Educational quantum state simulator · Exact matrix mechanics & finite-shot sampling</span>
          <div className="engine-status" style={{ fontSize: '11px' }}>
            <span className="live-dot" /> Client-Side Vector Engine
          </div>
        </footer>
      </main>
    </div>
  );
}
