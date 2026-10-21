// Solver en el tiempo (Δt + estado previo): curva de carga de un condensador (RC) y corriente
// de una bobina en serie (RL), más el óhmetro tratando ambos en su límite de DC.
const { createLab } = require('./harness');

module.exports = function testTransient() {
  const errors = [];
  const { Lab, advance, tick, wire, readingOf, DT } = createLab();
  const firstNumber = (s) => parseFloat(s);

  // ======================= RC: carga de un condensador =======================
  Lab.addComponent('pcl-battery', 0, 0, 'bat1', 0, { voltage: 9 });
  Lab.addComponent('wokwi-resistor', 0, 0, 'r1', 0, { value: '1000' });
  const cap = Lab.addComponent('pcl-capacitor', 0, 0, 'cap1', 0, { value: 1000 }); // 1000 µF
  wire('bat1', '+', 'r1', '1'); wire('r1', '2', 'cap1', '1'); wire('cap1', '2', 'bat1', '-');

  const R = 1000, C = 1000e-6, tau = R * C; // 1 s
  Lab.setRunning(true);

  const series = [];
  for (let t = 0; t < 10 * tau; t += DT) { advance(DT * 1000); Lab.refreshSim(); series.push({ t: t + DT, v: firstNumber(readingOf(cap)) }); }

  for (let k = 1; k < series.length; k++) {
    if (series[k].v < series[k - 1].v - 1e-6) errors.push(`RC: el voltaje bajó en t=${series[k].t.toFixed(2)}s`);
    if (series[k].v > 9.01) errors.push(`RC: el condensador superó los 9V en t=${series[k].t.toFixed(2)}s (${series[k].v}V)`);
  }
  const vAtTau = series.find((p) => Math.abs(p.t - tau) < DT / 2).v;
  const expectedAtTau = 9 * (1 - Math.exp(-1)); // ≈ 5.69 V
  if (Math.abs(vAtTau - expectedAtTau) > 0.5) errors.push(`RC: en t=τ=1s se esperaba ≈${expectedAtTau.toFixed(2)}V, dio ${vAtTau}V`);
  const vFinal = series[series.length - 1].v;
  if (Math.abs(vFinal - 9) > 0.1) errors.push(`RC: tras 10τ se esperaba ≈9V, dio ${vFinal}V`);

  Lab.setRunning(false);
  Lab.setRunning(true); // debe reiniciar descargado
  advance(DT * 1000); Lab.refreshSim();
  if (firstNumber(readingOf(cap)) > 1) errors.push('RC: tras reiniciar Play, el condensador debía arrancar descargado (~0V)');
  Lab.setRunning(false);

  // ======================= RL: bobina en serie =======================
  Lab.addComponent('pcl-battery', 0, 0, 'bat2', 0, { voltage: 9 });
  Lab.addComponent('wokwi-resistor', 0, 0, 'r2', 0, { value: '1000' });
  const ind = Lab.addComponent('pcl-inductor', 0, 0, 'ind1', 0, { value: 100 }); // 100 H, R=1kΩ -> τ=0.1s
  wire('bat2', '+', 'r2', '1'); wire('r2', '2', 'ind1', '1'); wire('ind1', '2', 'bat2', '-');

  Lab.setRunning(true);
  tick(2);
  const indReading = readingOf(ind);
  const iInd = parseFloat(indReading.split('·')[1]);
  const vInd = parseFloat(indReading);
  if (Math.abs(vInd) > 0.1) errors.push(`RL: en estado estacionario la bobina debía tener ~0V, tiene ${vInd}V`);
  if (Math.abs(iInd - 9) > 2) errors.push(`RL: en estado estacionario se esperaba ≈9mA, dio ${iInd}mA`);
  Lab.setRunning(false);

  // ======================= Óhmetro sobre bobina/condensador sueltos =======================
  const om = Lab.addComponent('pcl-ohmmeter', 0, 0, 'om1');
  const indLoose = Lab.addComponent('pcl-inductor', 0, 0, 'indLoose', 0, { value: 1 });
  wire('om1', 'COM', 'indLoose', '1'); wire('om1', 'Ω', 'indLoose', '2');
  Lab.refreshSim();
  const indOhm = readingOf(om);
  if (!/^0\.[0-9] ?Ω/.test(indOhm)) errors.push(`Óhmetro sobre bobina: se esperaba ~0 Ω, dio "${indOhm}"`);

  const capLoose = Lab.addComponent('pcl-capacitor', 0, 0, 'capLoose', 0, { value: 100 });
  Lab.wires = Lab.wires.filter((w) => w.from.component !== 'indLoose' && w.to.component !== 'indLoose');
  wire('om1', 'COM', 'capLoose', '1'); wire('om1', 'Ω', 'capLoose', '2');
  Lab.refreshSim();
  const capOhm = readingOf(om);
  if (capOhm !== 'OL') errors.push(`Óhmetro sobre condensador: se esperaba "OL", dio "${capOhm}"`);

  return { name: 'Solver en el tiempo (condensador RC / bobina RL)', errors };
};
