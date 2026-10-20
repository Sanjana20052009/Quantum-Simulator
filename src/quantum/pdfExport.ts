import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SimulationPayload, SimulationResult, formatInitialLabel } from './engine';

export function exportPdf(payload: SimulationPayload, result: SimulationResult) {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  const initLabel = formatInitialLabel(payload.initial_state);
  const gateSeq =
    payload.gates
      .map((g) => g.name + (g.name.startsWith('R') && g.angle !== undefined ? ` (${g.angle}°)` : ''))
      .join(' → ') || 'No gates applied';

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(18, 48, 71);
  doc.text('QubitLab — Quantum Experiment Report', 40, 50);

  // Subtitle / metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 60, 70);

  const lines = [
    `Initial state: ${initLabel}`,
    `Gate sequence: ${gateSeq}`,
    `Shots: ${payload.shots}`,
    `P(0) = ${result.probabilities['0'].toFixed(5)}; P(1) = ${result.probabilities['1'].toFixed(5)}`,
    `Fidelity to |${payload.target_state}⟩: ${result.fidelity.value.toFixed(6)}`,
    `Bloch vector: (${result.bloch.x.toFixed(4)}, ${result.bloch.y.toFixed(4)}, ${result.bloch.z.toFixed(4)})`,
    `Relative phase: ${result.relative_phase_degrees !== null ? `${result.relative_phase_degrees.toFixed(2)}°` : 'undefined'}`,
    `Qiskit cross-check error: ${result.qiskit_cross_check_error.toExponential(3)}`,
  ];

  let currentY = 75;
  for (const line of lines) {
    doc.text(line, 40, currentY);
    currentY += 15;
  }

  currentY += 10;

  // Table
  const tableData = result.history.map((h, i) => [
    String(i),
    h.label,
    `${h.alpha.real.toFixed(3)}${h.alpha.imag >= 0 ? '+' : ''}${h.alpha.imag.toFixed(3)}i`,
    `${h.beta.real.toFixed(3)}${h.beta.imag >= 0 ? '+' : ''}${h.beta.imag.toFixed(3)}i`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Step', 'Operation', 'α amplitude', 'β amplitude']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [18, 48, 71],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [242, 246, 250],
    },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 100;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 115, 130);
  doc.text(
    `Observed counts: 0 = ${result.measurement.counts['0']}; 1 = ${result.measurement.counts['1']}. Educational simulation only; no quantum hardware is used.`,
    40,
    finalY + 20
  );

  doc.save('qubitlab-experiment.pdf');
}
