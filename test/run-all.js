// Corre todas las pruebas de regresión del simulador (ver README.md de esta carpeta).
// Uso: npm test
const path = require('path');

const files = [
  'catalog.test.js',
  'sidebar.test.js',
  'meters.test.js',
  'transient.test.js',
  'source-scope.test.js'
];

let anyFail = false;
files.forEach((f) => {
  let name = f, errors;
  try {
    const mod = require(path.join(__dirname, f));
    ({ name, errors } = mod());
  } catch (e) {
    errors = ['Excepción: ' + (e && e.stack || e)];
  }
  if (errors.length) {
    anyFail = true;
    console.log(`✗ ${name}`);
    errors.forEach((e) => console.log('   - ' + e));
  } else {
    console.log(`✓ ${name}`);
  }
});

// sim.js arranca un setInterval (reloj maestro) que en el navegador vive mientras la página esté
// abierta; aquí hay que forzar la salida o Node se queda esperando ese temporizador para siempre.
process.exit(anyFail ? 1 : 0);
