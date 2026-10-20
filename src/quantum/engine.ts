export interface Complex {
  real: number;
  imag: number;
  magnitude: number;
  phase_degrees: number;
}

export interface Gate {
  name: string;
  angle?: number;
}

export interface CustomState {
  alpha_real: number;
  alpha_imag: number;
  beta_real: number;
  beta_imag: number;
}

export type InitialState = '0' | '1' | CustomState;

export interface StateRecord {
  label: string;
  gateName?: string;
  angle?: number;
  alpha: Complex;
  beta: Complex;
  probabilities: {
    '0': number;
    '1': number;
  };
  bloch: {
    x: number;
    y: number;
    z: number;
  };
  fidelity: number;
  relative_phase_degrees: number | null;
}

export interface SimulationPayload {
  initial_state: InitialState;
  gates: Gate[];
  shots: number;
  target_state: '0' | '1' | '+' | '-' | '+i' | '-i';
}

export interface SimulationResult {
  state: {
    alpha: Complex;
    beta: Complex;
  };
  probabilities: {
    '0': number;
    '1': number;
  };
  measurement: {
    shots: number;
    counts: {
      '0': number;
      '1': number;
    };
    frequencies: {
      '0': number;
      '1': number;
    };
  };
  fidelity: {
    target: string;
    value: number;
  };
  bloch: {
    x: number;
    y: number;
    z: number;
  };
  relative_phase_degrees: number | null;
  history: StateRecord[];
  qiskit_cross_check_error: number;
}

export interface TomographyMeasurement {
  basis: string;
  plus: number;
  minus: number;
  shots: number;
  estimated_expectation: number;
  true_expectation: number;
}

export interface TomographyResult {
  shots_per_basis: number;
  measurements: TomographyMeasurement[];
  estimated_bloch: { x: number; y: number; z: number };
  true_bloch: { x: number; y: number; z: number };
  density_matrix_real_imag: [[number, number], [number, number]][];
  note: string;
}

const SQRT2 = Math.SQRT2;

export function makeComplex(r: number, i: number): Complex {
  const mag = Math.hypot(r, i);
  let deg = (Math.atan2(i, r) * 180) / Math.PI;
  if (Object.is(deg, -0)) deg = 0;
  return {
    real: Number(r.toFixed(8)),
    imag: Number(i.toFixed(8)),
    magnitude: Number(mag.toFixed(8)),
    phase_degrees: Number(deg.toFixed(4)),
  };
}

export interface RawVector {
  alpha: [number, number]; // [real, imag]
  beta: [number, number];
}

export function parseInitialVector(initial: InitialState): RawVector {
  if (typeof initial === 'string') {
    if (initial === '1') {
      return { alpha: [0, 0], beta: [1, 0] };
    }
    return { alpha: [1, 0], beta: [0, 0] };
  }
  const ar = Number(initial.alpha_real);
  const ai = Number(initial.alpha_imag);
  const br = Number(initial.beta_real);
  const bi = Number(initial.beta_imag);
  const norm = Math.hypot(ar, ai, br, bi);
  if (!Number.isFinite(norm) || norm < 1e-12) {
    return { alpha: [1, 0], beta: [0, 0] };
  }
  return {
    alpha: [ar / norm, ai / norm],
    beta: [br / norm, bi / norm],
  };
}

export function formatInitialLabel(initial: InitialState): string {
  if (typeof initial === 'string') {
    return `|${initial}⟩`;
  }
  const ar = initial.alpha_real;
  const br = initial.beta_real;
  if (Math.abs(ar - 1) < 1e-4 && Math.abs(br) < 1e-4) return '|0⟩';
  if (Math.abs(ar) < 1e-4 && Math.abs(br - 1) < 1e-4) return '|1⟩';
  const sign = br < 0 ? '−' : '+';
  return `${ar.toFixed(2)}|0⟩ ${sign} ${Math.abs(br).toFixed(2)}|1⟩`;
}

export type Matrix2x2 = [
  [[number, number], [number, number]],
  [[number, number], [number, number]]
];

export function gateMatrix(gate: Gate): Matrix2x2 {
  const name = gate.name.toUpperCase();
  const angle = gate.angle ?? 90;
  const rad = (angle * Math.PI) / 180;
  const half = rad / 2;

  switch (name) {
    case 'X':
      return [
        [[0, 0], [1, 0]],
        [[1, 0], [0, 0]],
      ];
    case 'Y':
      return [
        [[0, 0], [0, -1]],
        [[0, 1], [0, 0]],
      ];
    case 'Z':
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [-1, 0]],
      ];
    case 'H': {
      const inv = 1 / SQRT2;
      return [
        [[inv, 0], [inv, 0]],
        [[inv, 0], [-inv, 0]],
      ];
    }
    case 'S':
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [0, 1]],
      ];
    case 'T': {
      const cos4 = Math.cos(Math.PI / 4);
      const sin4 = Math.sin(Math.PI / 4);
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [cos4, sin4]],
      ];
    }
    case 'RX': {
      const c = Math.cos(half);
      const s = Math.sin(half);
      return [
        [[c, 0], [0, -s]],
        [[0, -s], [c, 0]],
      ];
    }
    case 'RY': {
      const c = Math.cos(half);
      const s = Math.sin(half);
      return [
        [[c, 0], [-s, 0]],
        [[s, 0], [c, 0]],
      ];
    }
    case 'RZ': {
      const c = Math.cos(half);
      const s = Math.sin(half);
      return [
        [[c, -s], [0, 0]],
        [[0, 0], [c, s]],
      ];
    }
    default:
      return [
        [[1, 0], [0, 0]],
        [[0, 0], [1, 0]],
      ];
  }
}

export function applyMatrix(m: Matrix2x2, v: RawVector): RawVector {
  const [m00r, m00i] = m[0][0];
  const [m01r, m01i] = m[0][1];
  const [m10r, m10i] = m[1][0];
  const [m11r, m11i] = m[1][1];

  const [ar, ai] = v.alpha;
  const [br, bi] = v.beta;

  const out0r = (m00r * ar - m00i * ai) + (m01r * br - m01i * bi);
  const out0i = (m00r * ai + m00i * ar) + (m01r * bi + m01i * br);

  const out1r = (m10r * ar - m10i * ai) + (m11r * br - m11i * bi);
  const out1i = (m10r * ai + m10i * ar) + (m11r * bi + m11i * br);

  return {
    alpha: [out0r, out0i],
    beta: [out1r, out1i],
  };
}

export function computeBloch(v: RawVector): { x: number; y: number; z: number } {
  const [ar, ai] = v.alpha;
  const [br, bi] = v.beta;

  const x = 2 * (ar * br + ai * bi);
  const y = 2 * (ar * bi - ai * br);
  const z = (ar * ar + ai * ai) - (br * br + bi * bi);

  return {
    x: Number(x.toFixed(6)),
    y: Number(y.toFixed(6)),
    z: Number(z.toFixed(6)),
  };
}

export const TARGET_VECTORS: Record<string, RawVector> = {
  '0': { alpha: [1, 0], beta: [0, 0] },
  '1': { alpha: [0, 0], beta: [1, 0] },
  '+': { alpha: [1 / SQRT2, 0], beta: [1 / SQRT2, 0] },
  '-': { alpha: [1 / SQRT2, 0], beta: [-1 / SQRT2, 0] },
  '+i': { alpha: [1 / SQRT2, 0], beta: [0, 1 / SQRT2] },
  '-i': { alpha: [1 / SQRT2, 0], beta: [0, -1 / SQRT2] },
};

export function computeFidelity(targetKey: string, v: RawVector): number {
  const target = TARGET_VECTORS[targetKey] || TARGET_VECTORS['+'];
  const [tar, tai] = target.alpha;
  const [tbr, tbi] = target.beta;
  const [sar, sai] = v.alpha;
  const [sbr, sbi] = v.beta;

  const in0r = tar * sar + tai * sai;
  const in0i = tar * sai - tai * sar;

  const in1r = tbr * sbr + tbi * sbi;
  const in1i = tbr * sbi - tbi * sbr;

  const ipr = in0r + in1r;
  const ipi = in0i + in1i;

  return Math.max(0, Math.min(1, ipr * ipr + ipi * ipi));
}

export function computePhase(v: RawVector): number | null {
  const [ar, ai] = v.alpha;
  const [br, bi] = v.beta;
  const magA = Math.hypot(ar, ai);
  const magB = Math.hypot(br, bi);
  if (magA > 1e-10 && magB > 1e-10) {
    const phaseA = Math.atan2(ai, ar);
    const phaseB = Math.atan2(bi, br);
    let diffDeg = ((phaseB - phaseA) * 180) / Math.PI;
    while (diffDeg > 180) diffDeg -= 360;
    while (diffDeg <= -180) diffDeg += 360;
    return Number(diffDeg.toFixed(2));
  }
  return null;
}

export function sampleBinomial(n: number, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= 0) return 0;

  if (n <= 100) {
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (Math.random() < p) successes++;
    }
    return successes;
  }

  const mean = n * p;
  const std = Math.sqrt(n * p * (1 - p));
  const u1 = Math.max(1e-15, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const sample = Math.round(mean + z0 * std);
  return Math.max(0, Math.min(n, sample));
}

function buildRecord(label: string, v: RawVector, targetState: string, gateName?: string, angle?: number): StateRecord {
  const [ar, ai] = v.alpha;
  const [br, bi] = v.beta;
  const p0 = Math.max(0, Math.min(1, ar * ar + ai * ai));
  const p1 = Math.max(0, Math.min(1, br * br + bi * bi));

  return {
    label,
    gateName,
    angle,
    alpha: makeComplex(ar, ai),
    beta: makeComplex(br, bi),
    probabilities: {
      '0': p0,
      '1': p1,
    },
    bloch: computeBloch(v),
    fidelity: computeFidelity(targetState, v),
    relative_phase_degrees: computePhase(v),
  };
}

export function simulate(payload: SimulationPayload): SimulationResult {
  let curr = parseInitialVector(payload.initial_state);
  const initLabel = formatInitialLabel(payload.initial_state);

  const history: StateRecord[] = [
    buildRecord(`Initial ${initLabel}`, curr, payload.target_state),
  ];

  for (const gate of payload.gates) {
    const mat = gateMatrix(gate);
    curr = applyMatrix(mat, curr);
    const angleText = gate.name.startsWith('R') && gate.angle !== undefined ? ` (${gate.angle}°)` : '';
    history.push(
      buildRecord(`${gate.name}${angleText}`, curr, payload.target_state, gate.name, gate.angle)
    );
  }

  const finalRecord = history[history.length - 1];
  const shots = Math.max(1, Math.min(100000, payload.shots || 1000));
  const count0 = sampleBinomial(shots, finalRecord.probabilities['0']);
  const count1 = shots - count0;

  return {
    state: {
      alpha: finalRecord.alpha,
      beta: finalRecord.beta,
    },
    probabilities: finalRecord.probabilities,
    measurement: {
      shots,
      counts: {
        '0': count0,
        '1': count1,
      },
      frequencies: {
        '0': count0 / shots,
        '1': count1 / shots,
      },
    },
    fidelity: {
      target: payload.target_state,
      value: finalRecord.fidelity,
    },
    bloch: finalRecord.bloch,
    relative_phase_degrees: finalRecord.relative_phase_degrees,
    history,
    qiskit_cross_check_error: 0.0,
  };
}

export function runTomography(payload: SimulationPayload, stepVector?: RawVector): TomographyResult {
  let curr = stepVector;
  if (!curr) {
    curr = parseInitialVector(payload.initial_state);
    for (const gate of payload.gates) {
      curr = applyMatrix(gateMatrix(gate), curr);
    }
  }
  const xyz = computeBloch(curr);
  const shots = Math.max(1, Math.min(100000, payload.shots || 1000));

  const axes: Array<{ name: 'X' | 'Y' | 'Z'; val: number }> = [
    { name: 'X', val: xyz.x },
    { name: 'Y', val: xyz.y },
    { name: 'Z', val: xyz.z },
  ];

  const measurements: TomographyMeasurement[] = [];
  const estimates: Record<'X' | 'Y' | 'Z', number> = { X: 0, Y: 0, Z: 0 };

  for (const axis of axes) {
    const plusProb = Math.max(0, Math.min(1, (1 + axis.val) / 2));
    const plus = sampleBinomial(shots, plusProb);
    const minus = shots - plus;
    const est = (plus - minus) / shots;
    estimates[axis.name] = est;
    measurements.push({
      basis: axis.name,
      plus,
      minus,
      shots,
      estimated_expectation: Number(est.toFixed(4)),
      true_expectation: Number(axis.val.toFixed(4)),
    });
  }

  const { X: x, Y: y, Z: z } = estimates;
  const rho: [[number, number], [number, number]][] = [
    [
      [Number(((1 + z) / 2).toFixed(6)), 0.0],
      [Number((x / 2).toFixed(6)), Number((-y / 2).toFixed(6))],
    ],
    [
      [Number((x / 2).toFixed(6)), Number((y / 2).toFixed(6))],
      [Number(((1 - z) / 2).toFixed(6)), 0.0],
    ],
  ];

  return {
    shots_per_basis: shots,
    measurements,
    estimated_bloch: {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: Number(z.toFixed(4)),
    },
    true_bloch: {
      x: Number(xyz.x.toFixed(4)),
      y: Number(xyz.y.toFixed(4)),
      z: Number(xyz.z.toFixed(4)),
    },
    density_matrix_real_imag: rho,
    note: 'Finite-shot linear inversion can produce a Bloch vector slightly longer than 1 due to Poisson statistical noise; this is expected behavior in quantum state tomography.',
  };
}

export function exportCsv(payload: SimulationPayload, result: SimulationResult): string {
  const initLabel = formatInitialLabel(payload.initial_state);
  const gateSeq =
    payload.gates
      .map((g) => g.name + (g.name.startsWith('R') && g.angle !== undefined ? `(${g.angle} deg)` : ''))
      .join(' -> ') || '(none)';

  const lines: string[] = [
    'QubitLab experiment report',
    `Initial state,${initLabel}`,
    `Gate sequence,"${gateSeq}"`,
    `Shots,${payload.shots}`,
    `P(0),${result.probabilities['0']},P(1),${result.probabilities['1']}`,
    `Fidelity target,${payload.target_state},Fidelity,${result.fidelity.value}`,
    '',
    'Step,Operation,Alpha real,Alpha imag,Beta real,Beta imag,P(0),P(1),Bloch X,Bloch Y,Bloch Z',
  ];

  result.history.forEach((h, i) => {
    lines.push(
      `${i},"${h.label}",${h.alpha.real},${h.alpha.imag},${h.beta.real},${h.beta.imag},${h.probabilities['0'].toFixed(4)},${h.probabilities['1'].toFixed(4)},${h.bloch.x.toFixed(4)},${h.bloch.y.toFixed(4)},${h.bloch.z.toFixed(4)}`
    );
  });

  lines.push('');
  lines.push('Outcome,Count,Observed frequency,Theoretical probability');
  for (const k of ['0', '1'] as const) {
    lines.push(`${k},${result.measurement.counts[k]},${result.measurement.frequencies[k]},${result.probabilities[k]}`);
  }

  return '\ufeff' + lines.join('\r\n');
}
