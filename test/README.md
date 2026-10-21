# Pruebas de regresión

Corren el simulador (`js/canvas.js`, `js/parts.js`, `js/sim.js`, `js/app.js`) dentro de una página
simulada con [jsdom](https://github.com/jsdom/jsdom), sin navegador ni backend. Verifican el
catálogo, el buscador, el "banco de medidas" (voltímetro/amperímetro/óhmetro/multímetro) y el
solver en el tiempo (condensador/bobina, fuente variable, osciloscopio).

No reemplazan probar la app en el navegador real — son una red de seguridad para detectar si un
cambio rompe el solver, el netlist o el catálogo antes de subirlo.

## Cómo correrlas

```
npm install   # solo la primera vez, instala jsdom como devDependency
npm test
```

Sale con código 0 si todo pasa, o 1 si alguna prueba falló (imprime qué falló y por qué).

## Qué cubre cada archivo

- `catalog.test.js` — que el catálogo tenga los componentes nuevos registrados como custom elements.
- `sidebar.test.js` — que la barra lateral arme una fila por componente y que el buscador filtre bien.
- `meters.test.js` — el circuito de ejemplo R1 serie + (R2‖R3), con los 4 instrumentos de medición.
- `transient.test.js` — curva de carga de un condensador (RC) y corriente de una bobina (RL) contra la fórmula teórica.
- `source-scope.test.js` — las 4 formas de onda de la fuente variable y el muestreo del osciloscopio.

## Si agregas un componente o cambias el solver

Agrega su caso de prueba en el archivo que corresponda (o uno nuevo, registrado en
`run-all.js`), sobre todo si toca `js/sim.js` (netlist, `solve()`, `measureResistance()`) — ahí
es donde más fácil se rompe algo sin darse cuenta.
