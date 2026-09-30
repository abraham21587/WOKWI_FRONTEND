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

  [['pcl-diode', Diode], ['pcl-battery', Battery], ['pcl-breadboard', Breadboard]].forEach(([n, c]) => {
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

  // Catálogo (solo etiquetas que existen en @wokwi/elements 1.9.x + las propias)
  const C = (label, cat, props = {}) => ({ label, cat, props });
  Lab.CATALOG = {
    'wokwi-arduino-uno': C('Arduino Uno', 'Microcontroladores'),
    'wokwi-arduino-nano': C('Arduino Nano', 'Microcontroladores'),
    'pcl-battery': C('Batería / Fuente DC', 'Alimentación', { voltage: 9 }),
    'pcl-breadboard': C('Protoboard', 'Conexión'),
    'wokwi-resistor': C('Resistencia', 'Pasivos', { value: '220' }),
    'wokwi-potentiometer': C('Potenciómetro', 'Pasivos'),
    'wokwi-slide-potentiometer': C('Potenciómetro deslizante', 'Pasivos'),
    'pcl-diode': C('Diodo 1N4007', 'Semiconductores', { vf: 0.7 }),
    'wokwi-led': C('LED', 'Semiconductores', { color: 'red' }),
    'wokwi-rgb-led': C('LED RGB', 'Semiconductores'),
    'wokwi-pushbutton': C('Pulsador', 'Entradas'),
    'wokwi-slide-switch': C('Interruptor deslizante', 'Entradas'),
    'wokwi-dip-switch-8': C('DIP Switch 8', 'Entradas'),
    'wokwi-membrane-keypad': C('Teclado 4x4', 'Entradas'),
    'wokwi-buzzer': C('Buzzer', 'Salidas'),
    'wokwi-servo': C('Servomotor', 'Salidas'),
    'wokwi-stepper-motor': C('Motor paso a paso', 'Salidas'),
    'wokwi-7segment': C('Display 7 segmentos', 'Salidas'),
    'wokwi-led-bar-graph': C('Barra de LEDs', 'Salidas'),
    'wokwi-neopixel': C('NeoPixel', 'Salidas'),
    'wokwi-lcd1602': C('LCD 16x2', 'Pantallas'),
    'wokwi-lcd2004': C('LCD 20x4', 'Pantallas'),
    'wokwi-ssd1306': C('OLED SSD1306', 'Pantallas'),
    'wokwi-hc-sr04': C('Ultrasónico HC-SR04', 'Sensores'),
    'wokwi-dht22': C('Temp./Humedad DHT22', 'Sensores'),
    'wokwi-ntc-temperature-sensor': C('Termistor NTC', 'Sensores'),
    'wokwi-photoresistor-sensor': C('Fotorresistencia', 'Sensores'),
    'wokwi-pir-motion-sensor': C('Sensor PIR', 'Sensores')
  };

  // La protoboard siempre queda detrás de los demás componentes
  const add = Lab.addComponent;
  Lab.addComponent = (...a) => {
    const c = add(...a);
    if (c) c.w.style.zIndex = c.type === 'pcl-breadboard' ? 0 : 1;
    return c;
  };
})();