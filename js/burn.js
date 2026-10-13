// Efecto de "quemado" compartido: cualquier componente que reciba más corriente/potencia de la que
// soporta queda carbonizado (chispazo + humo) de forma permanente, con la MISMA animación para todos.
(() => {
  if (typeof window === 'undefined' || !window.Lab) return;
  const PUFFS = 7;

  // Marca el componente como quemado (desconectado del circuito desde el próximo cálculo) y lanza
  // la animación una sola vez. Idempotente: si ya estaba quemado, no hace nada.
  Lab.triggerBurn = (c, reason) => {
    if (c.burned) return;
    c.burned = true;
    c.w.classList.remove('lit');
    c.w.classList.add('burned');
    Lab.select && Lab.sel === c && Lab.select(null);
    Lab.redraw && Lab.redraw(); // apaga también los cables que llegaban a esta pieza

    const name = (Lab.CATALOG[c.type] && Lab.CATALOG[c.type].label) || c.type;
    Lab.status(`🔥 ¡${name} quemado! ${reason || ''}`);

    const fx = document.createElement('div');
    fx.className = 'burn-fx';
    fx.style.transform = `rotate(${-c.rotation}deg)`;
    fx.appendChild(document.createElement('div')).className = 'burn-flash';
    for (let k = 0; k < PUFFS; k++) {
      const p = document.createElement('div');
      p.className = 'smoke-puff';
      const size = 14 + Math.random() * 12;
      p.style.width = p.style.height = size + 'px';
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 50).toFixed(0) + 'px');
      p.style.animationDelay = (k * 85 + Math.random() * 40).toFixed(0) + 'ms';
      fx.appendChild(p);
    }
    c.w.appendChild(fx);
    setTimeout(() => fx.remove(), 1700);
  };
})();
