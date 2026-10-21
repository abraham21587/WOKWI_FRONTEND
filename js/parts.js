// Componentes propios (diodo, batería, protoboard) + catálogo completo de la paleta
(() => {
  class Part extends HTMLElement {
    connectedCallback() { this.style.display = 'block'; this.draw(); }
  }
  const prop = (cls, name, def) =>
    Object.defineProperty(cls.prototype, name, {
      get() { return this['_' + name] ?? def; },
      set(v) { this['_' + name] = v; if (this.isConnected) this.draw(); }
    });

  class Diode extends Part {
    get pinInfo() { return [{ name: 'A', x: 2, y: 12 }, { name: 'K', x: 68, y: 12 }]; }
    draw() {
      this.innerHTML = `<svg width="70" height="24" viewBox="0 0 70 24">
        <line x1="2" y1="12" x2="68" y2="12" stroke="#bbb" stroke-width="2"/>
        <rect x="14" y="4" width="42" height="16" rx="3" fill="#222" stroke="#555"/>
        <rect x="46" y="4" width="6" height="16" fill="#ccc"/>
        <text x="18" y="15" fill="#aaa" font-size="7" font-family="monospace">1N4007</text></svg>`;
    }
  }
  prop(Diode, 'vf', 0.7);

  class Battery extends Part {
    get pinInfo() { return [{ name: '+', x: 76, y: 10 }, { name: '-', x: 76, y: 30 }]; }
    draw() {
      this.innerHTML = `<svg width="80" height="40" viewBox="0 0 80 40">
        <line x1="60" y1="10" x2="76" y2="10" stroke="#FF5555" stroke-width="3"/>
        <line x1="60" y1="30" x2="76" y2="30" stroke="#888" stroke-width="3"/>
        <rect x="1" y="1" width="60" height="38" rx="5" fill="#1e1e2e" stroke="#89DCEB"/>
        <text x="30" y="25" text-anchor="middle" fill="#A6E3A1" font-size="14" font-family="monospace">${Number(this.voltage)}V</text>
        <text x="63" y="8" fill="#FF5555" font-size="9">+</text><text x="63" y="28" fill="#ccc" font-size="9">−</text></svg>`;
    }
  }
  prop(Battery, 'voltage', 9);

  // Protoboard de 30 columnas: columnas a-e y f-j conectadas entre sí; 4 rieles de alimentación
  const P = 12, X0 = 20, BB = [];
  for (let c = 1; c <= 30; c++) {
    const x = X0 + (c - 1) * P;
    'abcde'.split('').forEach((r, i) => BB.push({ name: c + r, x, y: 52 + i * P }));
    'fghij'.split('').forEach((r, i) => BB.push({ name: c + r, x, y: 122 + i * P }));
  }
  [['T+', 14], ['T-', 26], ['B+', 196], ['B-', 208]].forEach(([n, y]) => {
    for (let k = 1; k <= 25; k++) BB.push({ name: n + '.' + k, x: 38 + (k - 1) * P + Math.floor((k - 1) / 5) * 6, y });
  });
  class Breadboard extends Part {
    get pinInfo() { return BB; }
    draw() {
      const holes = BB.map((p) => `<rect x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" rx="1" fill="#0d0e15"/>`).join('');
      let nums = '';
      for (let c = 1; c <= 30; c++) if (c === 1 || c % 5 === 0) nums += `<text x="${X0 + (c - 1) * P}" y="42" fill="#6c7086" font-size="7" text-anchor="middle">${c}</text>`;
      const letters = 'abcde'.split('').map((l, i) => `<text x="6" y="${55 + i * P}" fill="#6c7086" font-size="7">${l}</text>`).join('') +
        'fghij'.split('').map((l, i) => `<text x="6" y="${125 + i * P}" fill="#6c7086" font-size="7">${l}</text>`).join('');
      this.innerHTML = `<svg width="388" height="224" viewBox="0 0 388 224">
        <rect x="0" y="0" width="388" height="224" rx="6" fill="#2b2d3f" stroke="#45475a"/>
        <rect x="8" y="108" width="372" height="8" fill="#1e1e2e"/>
        <line x1="30" y1="6" x2="358" y2="6" stroke="#FF5555"/><line x1="30" y1="32" x2="358" y2="32" stroke="#89B4FA"/>
        <line x1="30" y1="188" x2="358" y2="188" stroke="#FF5555"/><line x1="30" y1="214" x2="358" y2="214" stroke="#89B4FA"/>
        ${holes}${nums}${letters}</svg>`;
    }
  }

  class Capacitor extends Part {
    get pinInfo() { return [{ name: '1', x: 2, y: 12 }, { name: '2', x: 48, y: 12 }]; }
    draw() {
      this.innerHTML = `<svg width="50" height="24" viewBox="0 0 50 24">
        <line x1="2" y1="12" x2="21" y2="12" stroke="#bbb" stroke-width="2"/>
        <line x1="29" y1="12" x2="48" y2="12" stroke="#bbb" stroke-width="2"/>
        <line x1="21" y1="2" x2="21" y2="22" stroke="#89DCEB" stroke-width="3"/>
        <line x1="29" y1="2" x2="29" y2="22" stroke="#89DCEB" stroke-width="3"/></svg>`;
    }
  }
  prop(Capacitor, 'value', 1000); // µF

  class Inductor extends Part {
    get pinInfo() { return [{ name: '1', x: 2, y: 12 }, { name: '2', x: 68, y: 12 }]; }
    draw() {
      this.innerHTML = `<svg width="70" height="24" viewBox="0 0 70 24">
        <line x1="2" y1="12" x2="11" y2="12" stroke="#bbb" stroke-width="2"/>
        <path d="M11,12 a5.75,8 0 0 1 11.5,0 a5.75,8 0 0 1 11.5,0 a5.75,8 0 0 1 11.5,0 a5.75,8 0 0 1 11.5,0"
          fill="none" stroke="#FAB387" stroke-width="2.5"/>
        <line x1="59" y1="12" x2="68" y2="12" stroke="#bbb" stroke-width="2"/></svg>`;
    }
  }
  prop(Inductor, 'value', 1); // H

  // Fuente variable: como la batería, pero con forma de onda (DC/cuadrada/senoidal/triangular)
  // configurable — ideal para alimentar circuitos que se observan con el osciloscopio.
  const WAVE_ICON = {
    DC: '<line x1="8" y1="22" x2="62" y2="22" stroke="#CBA6F7" stroke-width="1.5"/>',
    square: '<path d="M8,30 L8,14 L22,14 L22,30 L36,30 L36,14 L50,14 L50,30 L62,30" fill="none" stroke="#CBA6F7" stroke-width="1.5"/>',
    sine: '<path d="M8,22 Q15,8 22,22 T36,22 T50,22 T64,22" fill="none" stroke="#CBA6F7" stroke-width="1.5"/>',
    triangle: '<path d="M8,30 L15,14 L22,30 L29,14 L36,30 L43,14 L50,30 L57,14" fill="none" stroke="#CBA6F7" stroke-width="1.5"/>'
  };
  const WAVE_LABEL = { DC: 'DC', square: 'CUADRADA', sine: 'SENOIDAL', triangle: 'TRIANGULAR' };
  class FunctionSource extends Part {
    get pinInfo() { return [{ name: '+', x: 86, y: 10 }, { name: '-', x: 86, y: 32 }]; }
    draw() {
      const mode = this.mode, amp = Number(this.amplitude), freq = Number(this.freq);
      const sub = mode === 'DC' ? `${amp}V` : `±${amp}V · ${freq}Hz`;
      this.innerHTML = `<svg width="90" height="44" viewBox="0 0 90 44">
        <line x1="70" y1="10" x2="86" y2="10" stroke="#FF5555" stroke-width="3"/>
        <line x1="70" y1="32" x2="86" y2="32" stroke="#888" stroke-width="3"/>
        <rect x="1" y="1" width="70" height="42" rx="5" fill="#1e1e2e" stroke="#89DCEB"/>
        ${WAVE_ICON[mode] || WAVE_ICON.DC}
        <text x="36" y="40" text-anchor="middle" fill="#A6E3A1" font-size="7" font-family="monospace">${sub}</text>
        <text x="73" y="8" fill="#FF5555" font-size="9">+</text><text x="73" y="30" fill="#ccc" font-size="9">−</text></svg>`;
    }
  }
  prop(FunctionSource, 'mode', 'DC');
  prop(FunctionSource, 'amplitude', 9);
  prop(FunctionSource, 'freq', 1);

  // Osciloscopio: 2 canales + GND común. El trazo lo actualiza sim.js llamando a renderTrace()
  // en cada paso de tiempo (no re-renderiza todo el componente, solo mueve los <path>).
  const SCOPE_W = 200, SCOPE_H = 160, SCOPE_DIVX = 10, SCOPE_DIVY = 8;
  class Oscilloscope extends Part {
    get pinInfo() { return [{ name: 'GND', x: 2, y: 140 }, { name: 'CH1', x: 2, y: 40 }, { name: 'CH2', x: 2, y: 70 }]; }
    draw() {
      let grid = '';
      for (let i = 1; i < SCOPE_DIVX; i++) grid += `<line x1="${i * SCOPE_W / SCOPE_DIVX}" y1="0" x2="${i * SCOPE_W / SCOPE_DIVX}" y2="${SCOPE_H}" stroke="#2a2a3a"/>`;
      for (let i = 1; i < SCOPE_DIVY; i++) grid += `<line x1="0" y1="${i * SCOPE_H / SCOPE_DIVY}" x2="${SCOPE_W}" y2="${i * SCOPE_H / SCOPE_DIVY}" stroke="#2a2a3a"/>`;
      this.innerHTML = `<svg width="${SCOPE_W + 20}" height="${SCOPE_H + 24}" viewBox="0 0 ${SCOPE_W + 20} ${SCOPE_H + 24}">
        <rect x="0" y="0" width="${SCOPE_W + 20}" height="${SCOPE_H + 24}" rx="6" fill="#1e1e2e" stroke="#89DCEB"/>
        <text x="${(SCOPE_W + 20) / 2}" y="12" text-anchor="middle" fill="#CBA6F7" font-size="8" font-family="monospace">OSCILOSCOPIO</text>
        <g transform="translate(10,16)">
          <rect x="0" y="0" width="${SCOPE_W}" height="${SCOPE_H}" fill="#0a0a12" stroke="#45475a"/>
          <line x1="0" y1="${SCOPE_H / 2}" x2="${SCOPE_W}" y2="${SCOPE_H / 2}" stroke="#45475a" stroke-dasharray="3 3"/>
          ${grid}
          <path class="tr1" d="" fill="none" stroke="#A6E3A1" stroke-width="1.5"/>
          <path class="tr2" d="" fill="none" stroke="#89DCEB" stroke-width="1.5"/>
        </g>
        <text x="4" y="${SCOPE_H + 36}" fill="#A6E3A1" font-size="7" font-family="monospace">CH1</text>
        <text x="30" y="${SCOPE_H + 36}" fill="#89DCEB" font-size="7" font-family="monospace">CH2</text>
        <text x="${SCOPE_W - 60}" y="${SCOPE_H + 36}" fill="#6c7086" font-size="7" font-family="monospace">${Number(this.voltDiv)}V/div · ${Number(this.timeDiv)}s/div</text>
      </svg>`;
    }
    // Mueve solo los trazos (llamado cada tick por sim.js); no toca el resto del SVG.
    renderTrace(samples, voltDiv, timeDiv) {
      const pxPerSec = SCOPE_W / (timeDiv * SCOPE_DIVX), pxPerVolt = SCOPE_H / (voltDiv * SCOPE_DIVY);
      const tMax = samples.length ? samples[samples.length - 1].t : 0;
      const x = (t) => (SCOPE_W - (tMax - t) * pxPerSec).toFixed(1);
      const y = (v) => (SCOPE_H / 2 - v * pxPerVolt).toFixed(1);
      const path = (key) => samples.map((s, i) => `${i ? 'L' : 'M'}${x(s.t)},${y(s[key])}`).join(' ');
      const p1 = this.querySelector('.tr1'), p2 = this.querySelector('.tr2');
      if (p1) p1.setAttribute('d', path('v1'));
      if (p2) p2.setAttribute('d', path('v2'));
    }
  }
  prop(Oscilloscope, 'voltDiv', 5);
  prop(Oscilloscope, 'timeDiv', 0.2);

  // Instrumentos de medición: misma estética "glass" que batería/diodo (pantalla oscura + texto neón).
  // La lectura en vivo la pone sim.js debajo del componente (igual que hace con resistencias/LEDs);
  // el texto dentro del SVG es solo el rótulo/placeholder del instrumento.
  const meterSvg = (title, placeholder, hotLabel, color) => `<svg width="90" height="50" viewBox="0 0 90 50">
    <rect x="1" y="1" width="88" height="48" rx="6" fill="#1e1e2e" stroke="#89DCEB"/>
    <text x="45" y="12" text-anchor="middle" fill="#CBA6F7" font-size="7" font-family="monospace">${title}</text>
    <rect x="8" y="17" width="74" height="17" rx="2" fill="#11111b" stroke="#45475a"/>
    <text x="45" y="29" text-anchor="middle" fill="${color}" font-size="9" font-family="monospace">${placeholder}</text>
    <line x1="0" y1="25" x2="8" y2="25" stroke="#ccc" stroke-width="2"/>
    <line x1="82" y1="25" x2="90" y2="25" stroke="${color}" stroke-width="2"/>
    <text x="3" y="45" fill="#6c7086" font-size="6">COM</text>
    <text x="70" y="45" fill="${color}" font-size="6">${hotLabel}</text></svg>`;

  class Voltmeter extends Part {
    get pinInfo() { return [{ name: 'COM', x: 2, y: 25 }, { name: 'V', x: 88, y: 25 }]; }
    draw() { this.innerHTML = meterSvg('VOLTÍMETRO', '0.00 V', 'V', '#A6E3A1'); }
  }
  class Ammeter extends Part {
    get pinInfo() { return [{ name: 'COM', x: 2, y: 25 }, { name: 'A', x: 88, y: 25 }]; }
    draw() { this.innerHTML = meterSvg('AMPERÍMETRO', '0 mA', 'A', '#F1FA8C'); }
  }
  class Ohmmeter extends Part {
    get pinInfo() { return [{ name: 'COM', x: 2, y: 25 }, { name: 'Ω', x: 88, y: 25 }]; }
    draw() { this.innerHTML = meterSvg('ÓHMETRO', '-- Ω', 'Ω', '#FAB387'); }
  }
  class Multimeter extends Part {
    get pinInfo() { return [{ name: 'COM', x: 2, y: 25 }, { name: 'VΩA', x: 88, y: 25 }]; }
    draw() {
      const ph = this.mode === 'A' ? '0 mA' : this.mode === 'Ω' ? '-- Ω' : '0.00 V';
      this.innerHTML = meterSvg('MULTÍMETRO · ' + this.mode, ph, 'VΩA', '#89DCEB');
    }
  }
  prop(Multimeter, 'mode', 'V');

  [['pcl-diode', Diode], ['pcl-battery', Battery], ['pcl-breadboard', Breadboard],
   ['pcl-capacitor', Capacitor], ['pcl-inductor', Inductor],
   ['pcl-function-source', FunctionSource], ['pcl-oscilloscope', Oscilloscope],
   ['pcl-voltmeter', Voltmeter], ['pcl-ammeter', Ammeter], ['pcl-ohmmeter', Ohmmeter], ['pcl-multimeter', Multimeter]
  ].forEach(([n, c]) => {
    if (!customElements.get(n)) customElements.define(n, c);
  });

  // Qué pines están unidos por dentro (lo usa el simulador)
  Lab.internalGroup = (type, pin) => {
    if (type === 'pcl-breadboard') {
      let m = pin.match(/^(\d+)([a-j])$/);
      if (m) return m[1] + (m[2] < 'f' ? 't' : 'b');
      m = pin.match(/^([TB][+-])\./);
      return m ? m[1] : null;
    }
    if (type === 'wokwi-pushbutton') return pin[0];
    if (/^wokwi-arduino/.test(type)) return pin.startsWith('GND') ? 'GND' : null;
    return null;
  };

  // Catálogo (solo etiquetas que existen en @wokwi/elements + las propias del laboratorio)
  const C = (label, cat, props = {}) => ({ label, cat, props });
  Lab.CATALOG = {
    'wokwi-arduino-uno': C('Arduino Uno', 'Microcontroladores'),
    'wokwi-arduino-nano': C('Arduino Nano', 'Microcontroladores'),
    'wokwi-arduino-mega': C('Arduino Mega', 'Microcontroladores'),
    'wokwi-esp32-devkit-v1': C('ESP32 DevKit V1', 'Microcontroladores'),
    'wokwi-nano-rp2040-connect': C('Nano RP2040 Connect', 'Microcontroladores'),
    'pcl-battery': C('Batería / Fuente DC', 'Alimentación', { voltage: 9 }),
    'pcl-function-source': C('Fuente variable (DC/onda)', 'Alimentación', { mode: 'DC', amplitude: 9, freq: 1 }),
    'pcl-breadboard': C('Protoboard', 'Conexión'),
    'wokwi-resistor': C('Resistencia', 'Pasivos', { value: '220' }),
    'wokwi-potentiometer': C('Potenciómetro', 'Pasivos'),
    'wokwi-slide-potentiometer': C('Potenciómetro deslizante', 'Pasivos'),
    'pcl-capacitor': C('Condensador', 'Pasivos', { value: 1000 }),
    'pcl-inductor': C('Bobina / Inductor', 'Pasivos', { value: 1 }),
    'pcl-diode': C('Diodo 1N4007', 'Semiconductores', { vf: 0.7 }),
    'wokwi-led': C('LED', 'Semiconductores', { color: 'red' }),
    'wokwi-rgb-led': C('LED RGB', 'Semiconductores'),
    'wokwi-pushbutton': C('Pulsador', 'Entradas'),
    'wokwi-pushbutton-6mm': C('Pulsador 6mm', 'Entradas'),
    'wokwi-slide-switch': C('Interruptor deslizante', 'Entradas'),
    'wokwi-tilt-switch': C('Interruptor de inclinación', 'Entradas'),
    'wokwi-dip-switch-8': C('DIP Switch 8', 'Entradas'),
    'wokwi-membrane-keypad': C('Teclado 4x4', 'Entradas'),
    'wokwi-analog-joystick': C('Joystick analógico', 'Entradas'),
    'wokwi-ky-040': C('Encoder rotativo KY-040', 'Entradas'),
    'wokwi-rotary-dialer': C('Disco rotativo', 'Entradas'),
    'wokwi-ir-remote': C('Control remoto IR', 'Entradas'),
    'wokwi-buzzer': C('Buzzer', 'Salidas'),
    'wokwi-servo': C('Servomotor', 'Salidas'),
    'wokwi-stepper-motor': C('Motor paso a paso', 'Salidas'),
    'wokwi-biaxial-stepper': C('Motor paso a paso biaxial', 'Salidas'),
    'wokwi-7segment': C('Display 7 segmentos', 'Salidas'),
    'wokwi-led-bar-graph': C('Barra de LEDs', 'Salidas'),
    'wokwi-led-ring': C('Anillo de LEDs', 'Salidas'),
    'wokwi-neopixel': C('NeoPixel', 'Salidas'),
    'wokwi-neopixel-matrix': C('Matriz NeoPixel', 'Salidas'),
    'wokwi-ks2e-m-dc5': C('Módulo relé KS2E-M-DC5', 'Salidas'),
    'wokwi-lcd1602': C('LCD 16x2', 'Pantallas'),
    'wokwi-lcd2004': C('LCD 20x4', 'Pantallas'),
    'wokwi-ssd1306': C('OLED SSD1306', 'Pantallas'),
    'wokwi-ili9341': C('TFT ILI9341', 'Pantallas'),
    'wokwi-hc-sr04': C('Ultrasónico HC-SR04', 'Sensores'),
    'wokwi-dht22': C('Temp./Humedad DHT22', 'Sensores'),
    'wokwi-ntc-temperature-sensor': C('Termistor NTC', 'Sensores'),
    'wokwi-photoresistor-sensor': C('Fotorresistencia', 'Sensores'),
    'wokwi-pir-motion-sensor': C('Sensor PIR', 'Sensores'),
    'wokwi-gas-sensor': C('Sensor de gas', 'Sensores'),
    'wokwi-flame-sensor': C('Sensor de llama', 'Sensores'),
    'wokwi-heart-beat-sensor': C('Sensor de pulso cardíaco', 'Sensores'),
    'wokwi-big-sound-sensor': C('Sensor de sonido (grande)', 'Sensores'),
    'wokwi-small-sound-sensor': C('Sensor de sonido (pequeño)', 'Sensores'),
    'wokwi-ir-receiver': C('Receptor IR', 'Sensores'),
    'wokwi-mpu6050': C('Acelerómetro/Giroscopio MPU6050', 'Sensores'),
    'wokwi-hx711': C('Amplificador de celda de carga HX711', 'Sensores'),
    'wokwi-ds1307': C('Reloj en tiempo real DS1307', 'Otros'),
    'wokwi-microsd-card': C('Tarjeta microSD', 'Otros'),
    'pcl-voltmeter': C('Voltímetro', 'Instrumentos'),
    'pcl-ammeter': C('Amperímetro', 'Instrumentos'),
    'pcl-ohmmeter': C('Óhmetro', 'Instrumentos'),
    'pcl-multimeter': C('Multímetro (V / A / Ω)', 'Instrumentos', { mode: 'V' }),
    'pcl-oscilloscope': C('Osciloscopio (2 canales)', 'Instrumentos', { voltDiv: 5, timeDiv: 0.2 })
  };

  // La protoboard siempre queda detrás de los demás componentes
  const add = Lab.addComponent;
  Lab.addComponent = (...a) => {
    const c = add(...a);
    if (c) c.w.style.zIndex = c.type === 'pcl-breadboard' ? 0 : 1;
    return c;
  };
})();