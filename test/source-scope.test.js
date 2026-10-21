// Fuente variable (DC/cuadrada/senoidal/triangular) + osciloscopio de 2 canales.
const { createLab } = require('./harness');

module.exports = function testSourceScope() {
  const errors = [];
  const { Lab, advance, tick, wire, readingOf, DT } = createLab();

  const src = Lab.addComponent('pcl-function-source', 0, 0, 'src1', 0, { mode: 'DC', amplitude: 10, freq: 1 });
  const rload = Lab.addComponent('wokwi-resistor', 0, 0, 'rload', 0, { value: '1000' });
  wire('src1', '+', 'rload', '1'); wire('rload', '2', 'src1', '-');

  // DC: el voltaje en la carga debe ser exactamente la amplitud (relación algebraica, sin Δt de por medio).
  Lab.setRunning(true);
  Lab.refreshSim();
  const vDC = parseFloat(readingOf(rload));
  if (Math.abs(vDC - 10) > 0.01) errors.push(`Fuente DC: se esperaba 10V en la carga, dio ${vDC}V`);
  Lab.setRunning(false);

  // Cuadrada: debe alternar entre +amp y -amp cada medio ciclo.
  src.props.mode = src.el.mode = 'square'; src.props.freq = src.el.freq = 2; // medio ciclo = 0.25s
  Lab.setRunning(true);
  Lab.refreshSim();
  const vSqA = parseFloat(readingOf(rload));
  tick(0.3); // avanza en pasos pequeños para no saltarse el semiciclo por el tope de Δt
  const vSqB = parseFloat(readingOf(rload));
  if (Math.abs(vSqA - 10) > 0.01) errors.push(`Fuente cuadrada: primer semiciclo esperaba +10V, dio ${vSqA}V`);
  if (Math.abs(vSqB + 10) > 0.01) errors.push(`Fuente cuadrada: segundo semiciclo esperaba -10V, dio ${vSqB}V`);
  Lab.setRunning(false);

  // Senoidal: comparar contra 10·sin(2πft) en varios instantes.
  src.props.mode = src.el.mode = 'sine'; src.props.freq = src.el.freq = 1;
  Lab.setRunning(true);
  for (let k = 0; k < 8; k++) {
    advance(71); Lab.refreshSim();
    const expected = 10 * Math.sin(2 * Math.PI * Lab._simTime * 1);
    const got = parseFloat(readingOf(rload));
    if (!isFinite(got) || Math.abs(got - expected) > 0.01) errors.push(`Fuente senoidal: en t=${Lab._simTime.toFixed(3)}s esperaba ${expected.toFixed(3)}V, dio ${got}V`);
  }
  Lab.setRunning(false);

  // ======================= Osciloscopio =======================
  const scope = Lab.addComponent('pcl-oscilloscope', 0, 0, 'scope1', 0, { voltDiv: 5, timeDiv: 0.2 });
  wire('scope1', 'GND', 'src1', '-'); wire('scope1', 'CH1', 'src1', '+'); wire('scope1', 'CH2', 'rload', '1');

  src.props.mode = src.el.mode = 'sine'; src.props.freq = src.el.freq = 1;
  Lab.setRunning(true);
  tick(1);

  if (!scope.scope || !scope.scope.samples.length) errors.push('Osciloscopio: no se acumularon muestras mientras corría');
  else {
    const n = scope.scope.samples.length;
    const last = scope.scope.samples[n - 1];
    const expected = 10 * Math.sin(2 * Math.PI * last.t);
    if (Math.abs(last.v1 - expected) > 0.05) errors.push('Osciloscopio: la última muestra de CH1 no coincide con la onda');
    const d1 = scope.el.querySelector('.tr1').getAttribute('d');
    if (!d1 || d1.length < 10) errors.push('Osciloscopio: el trazo CH1 quedó vacío tras simular');
  }

  tick(5); // la ventana de muestras no debe crecer sin límite
  const windowSec = scope.props.timeDiv * 10;
  const samples = scope.scope.samples;
  const span = samples.length ? samples[samples.length - 1].t - samples[0].t : 0;
  if (span > windowSec + 0.1) errors.push(`Osciloscopio: la ventana debía acotarse a ~${windowSec}s, abarca ${span.toFixed(2)}s`);

  Lab.setRunning(false);
  const countAfterStop1 = scope.scope.samples.length;
  advance(500); Lab.refreshSim(); Lab.refreshSim();
  if (scope.scope.samples.length !== countAfterStop1) errors.push('Osciloscopio: debía congelar el trazo al detener la simulación');

  Lab.setRunning(true);
  if (scope.scope.samples.length > 1) errors.push('Osciloscopio: al reiniciar Play debía limpiar el trazo anterior');
  Lab.setRunning(false);

  return { name: 'Fuente variable + osciloscopio', errors };
};
