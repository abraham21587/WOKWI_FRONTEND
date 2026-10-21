// Catálogo de componentes + buscador de la barra lateral.
const { createLab } = require('./harness');

module.exports = function testCatalog() {
  const errors = [];
  const { window, Lab } = createLab();

  const need = [
    'pcl-voltmeter', 'pcl-ammeter', 'pcl-ohmmeter', 'pcl-multimeter',
    'pcl-capacitor', 'pcl-inductor', 'pcl-function-source', 'pcl-oscilloscope'
  ];
  need.forEach((t) => {
    if (!Lab.CATALOG[t]) errors.push(`Falta en CATALOG: ${t}`);
    if (!window.customElements.get(t)) errors.push(`Custom element no registrado: ${t}`);
  });

  const catalogSize = Object.keys(Lab.CATALOG).length;
  if (catalogSize < 50) errors.push(`El catálogo tiene solo ${catalogSize} componentes (se esperaban al menos 50)`);

  // Cada entrada del catálogo debe poder instanciarse sin reventar (aunque el pinInfo
  // dependa de una librería externa que aquí no está, el <custom-element> debe existir).
  Object.keys(Lab.CATALOG).forEach((type) => {
    if (!window.customElements.get(type) && !/^wokwi-/.test(type)) {
      errors.push(`Tipo "${type}" del catálogo no tiene un custom element registrado`);
    }
  });

  return { name: 'Catálogo de componentes', errors };
};
