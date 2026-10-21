// Ejemplo base: "banco de medidas" (R1 en serie con R2‖R3), con voltímetro, amperímetro,
// multímetro y óhmetro — el mismo circuito usado para validar el laboratorio con el usuario.
const { createLab } = require('./harness');

module.exports = function testMeters() {
  const errors = [];
  const { Lab, wire, readingOf } = createLab();
  const close = (a, b, tol) => Math.abs(a - b) <= tol;

  Lab.addComponent('pcl-battery', 0, 0, 'bat1', 0, { voltage: 9 });
  Lab.addComponent('wokwi-resistor', 0, 0, 'r1', 0, { value: '1000' });
  Lab.addComponent('wokwi-resistor', 0, 0, 'r2', 0, { value: '2200' });
  Lab.addComponent('wokwi-resistor', 0, 0, 'r3', 0, { value: '3300' });
  const vm = Lab.addComponent('pcl-voltmeter', 0, 0, 'vm1');
  const am = Lab.addComponent('pcl-ammeter', 0, 0, 'am1');
  const om = Lab.addComponent('pcl-ohmmeter', 0, 0, 'om1');
  const mm = Lab.addComponent('pcl-multimeter', 0, 0, 'mm1', 0, { mode: 'V' });

  // A = bat+/r1.1 ; B = r1.2/r2.1/r3.1 ; C = r2.2/r3.2 -> amperímetro -> bat-
  wire('bat1', '+', 'r1', '1');
  wire('r1', '2', 'r2', '1');
  wire('r1', '2', 'r3', '1');
  wire('r2', '2', 'r3', '2');
  wire('r2', '2', 'am1', 'COM');
  wire('am1', 'A', 'bat1', '-');
  wire('vm1', 'COM', 'r1', '2'); wire('vm1', 'V', 'r2', '2'); // voltímetro: sobre R2‖R3
  wire('mm1', 'COM', 'bat1', '+'); wire('mm1', 'VΩA', 'r1', '2'); // multímetro (modo V): sobre R1
  wire('om1', 'COM', 'bat1', '+'); wire('om1', 'Ω', 'r2', '2'); // óhmetro: sobre todo el bloque

  const Req = 1000 + (2200 * 3300) / (2200 + 3300); // 2320 Ω
  const Itotal = 9 / Req; // ≈ 3.879 mA
  const Vpar = Itotal * (2200 * 3300) / (2200 + 3300); // ≈ 5.121 V
  const Vr1 = Itotal * 1000; // ≈ 3.879 V

  Lab.setRunning(true);

  const vmVal = parseFloat(readingOf(vm));
  const amVal = parseFloat(readingOf(am));
  const mmVal = parseFloat(readingOf(mm));
  if (!close(vmVal, Vpar, 0.01)) errors.push(`Voltímetro: esperado ≈${Vpar.toFixed(2)}V, dio ${vmVal}V`);
  if (!close(amVal, Itotal * 1000, 0.05)) errors.push(`Amperímetro: esperado ≈${(Itotal * 1000).toFixed(2)}mA, dio ${amVal}mA`);
  if (!close(mmVal, Vr1, 0.01)) errors.push(`Multímetro (V): esperado ≈${Vr1.toFixed(2)}V, dio ${mmVal}V`);

  const omRunning = readingOf(om);
  if (!/desconecta/i.test(omRunning)) errors.push(`Óhmetro corriendo: debía avisar que hay que desconectar la fuente, dio "${omRunning}"`);

  Lab.setRunning(false);
  const omText = readingOf(om);
  const mult = omText.includes('kΩ') ? 1000 : omText.includes('MΩ') ? 1e6 : 1;
  const omVal = parseFloat(omText) * mult;
  if (!close(omVal, Req, 1)) errors.push(`Óhmetro: esperado ≈${Req.toFixed(1)}Ω, dio "${omText}"`);

  return { name: 'Banco de medidas (voltímetro/amperímetro/óhmetro/multímetro)', errors };
};
