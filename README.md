# QubitLab — Quantum Gate Simulator

An interactive single-qubit quantum computer simulator built with React, Vite, and TypeScript.

## Features
- **9 Quantum Gates**: Pauli-X, Pauli-Y, Pauli-Z, Hadamard (H), Phase (S), π/8 (T), and arbitrary single-qubit rotations (RX, RY, RZ) with 1° angle precision.
- **Interactive 3D Bloch Sphere**: Draggable 3D projection SVG visualizing the quantum state vector and Bloch coordinates $(x, y, z)$.
- **Custom State Input**: Direct entry for real and imaginary amplitudes $\alpha$ and $\beta$ with automatic state normalization.
- **Circuit Playback & Timeline**: Step-by-step gate execution, step slider, automated playback, timeline scrubber, and undo/redo history.
- **Born Rule Probability & Measurement Lab**: Theoretical probabilities $P(0)$ and $P(1)$ alongside finite-shot measurement simulation (100 to 100,000 shots).
- **Quantum State Tomography**: Reconstructed density matrix $\rho$ from simulated finite-shot Pauli measurements along the X, Y, and Z bases.
- **Fidelity & Relative Phase**: Real-time state fidelity comparison against $|0\rangle$, $|1\rangle$, $|+\rangle$, $|-\rangle$, $|+i\rangle$, and $|-i\rangle$, plus relative phase calculation.
- **Learn & Quiz Mode**: Interactive knowledge check quizzes with answer explanations and guided gate challenges.
- **Experiment Reports**: Downloadable CSV data and formatted PDF report export.

## Development
Run the development server:
```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```
