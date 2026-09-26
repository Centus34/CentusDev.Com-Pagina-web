/* =========================================================
   Minijuego secreto de Centus Dev: "Los coches son esferas"
   Basado en el vídeo https://www.youtube.com/shorts/GBgDwVcaLh4
   Recoge 5 banderines en 25 s. Al ganar se revela el truco
   (tu coche era una esfera) y se desbloquea el modo debug.
   ========================================================= */

(function () {
  const W = 720;
  const H = 440;
  const TIME_LIMIT = 25;
  const CAR_RADIUS = 15;
  const MAX_SPEED = 255;
  const BEST_KEY = "centus-game-best";

  const COLORS = {
    cream: "#fffaf0",
    paper: "#fff5dc",
    yellow: "#ffec90",
    brown: "#623722",
    ink: "#2b170f",
    debug: "#22c55e",
    red: "#e5484d"
  };

  const CHECKPOINTS = [
    { x: 130, y: 100 },
    { x: 380, y: 215 },
    { x: 630, y: 95 },
    { x: 620, y: 350 },
    { x: 330, y: 372 }
  ];

  const CONES = [
    { x: 255, y: 110 }, { x: 250, y: 300 }, { x: 510, y: 110 },
    { x: 505, y: 290 }, { x: 160, y: 250 }, { x: 460, y: 390 }
  ];
  const CONE_RADIUS = 13;

  const readBest = () => {
    try { return Number(window.localStorage.getItem(BEST_KEY)) || null; } catch { return null; }
  };
  const writeBest = (value) => {
    try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* sin almacenamiento */ }
  };
  const format = (seconds) => seconds.toFixed(1).replace(".", ",");

  function create(canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    const wrapper = canvas.parentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const panel = document.createElement("div");
    panel.className = "game-panel";
    wrapper.append(panel);

    const input = { left: false, right: false };
    let state = "intro";
    let car;
    let checkpoint;
    let elapsed;
    let revealT = 0;
    let raf = 0;
    let last = 0;
    let particles = [];
    let smoke = [];
    let smokeTimer = 0;

    function reset() {
      car = { x: 80, y: 370, angle: -Math.PI / 2, vx: 0, vy: 0, speed: 0 };
      checkpoint = 0;
      elapsed = 0;
      revealT = 0;
      particles = [];
      smoke = [];
    }

    /* ----- Paneles HTML (accesibles) ----- */

    function showPanel(html) {
      panel.innerHTML = html;
      panel.hidden = false;
      const first = panel.querySelector("button, a");
      if (first) first.focus({ preventScroll: true });
    }

    function hidePanel() {
      panel.hidden = true;
      panel.innerHTML = "";
    }

    function intro() {
      state = "intro";
      reset();
      const best = readBest();
      showPanel(`
        <p class="game-panel-kicker">Minijuego secreto</p>
        <h3>Los coches son esferas</h3>
        <p>Recoge los <strong>5 banderines</strong> en menos de ${TIME_LIMIT} segundos. El coche acelera solo: tú solo giras.</p>
        <p class="game-panel-keys"><kbd>←</kbd> <kbd>→</kbd> o <kbd>A</kbd> <kbd>D</kbd> · en móvil, los botones</p>
        ${best ? `<p class="game-panel-best">Tu récord: ${format(best)} s</p>` : ""}
        <button class="btn btn-primary" type="button" data-action="start">¡Arrancar!</button>
      `);
    }

    function start() {
      hidePanel();
      reset();
      state = "play";
      canvas.focus({ preventScroll: true });
    }

    function win() {
      state = "reveal";
      revealT = 0;
      const time = elapsed;
      const best = readBest();
      const isRecord = !best || time < best;
      if (isRecord) writeBest(time);
      options.onWin?.(time);

      window.setTimeout(() => {
        if (state !== "reveal") return;
        state = "won";
        showPanel(`
          <p class="game-panel-kicker">${format(time)} s ${isRecord ? "· ¡nuevo récord!" : ""}</p>
          <h3>Pillado: era una esfera</h3>
          <p>Todo el rato has conducido una bola con un coche pintado encima. Muchos juegos de coches hacen algo parecido, y te lo cuento en un minuto.</p>
          <p class="game-panel-unlock">🔓 Has desbloqueado el <strong>modo debug</strong>: ahora puedes ver las hitboxes de toda la web (tecla <kbd>D</kbd>).</p>
          <div class="game-panel-actions">
            <button class="btn btn-primary" type="button" data-action="debug">Activar modo debug</button>
            <a class="btn btn-ghost" href="https://www.youtube.com/shorts/GBgDwVcaLh4" target="_blank" rel="noopener">Ver el vídeo</a>
            <button class="btn btn-ghost" type="button" data-action="start">Otra vez</button>
          </div>
        `);
      }, reduceMotion ? 200 : 1900);
    }

    function lose() {
      state = "lost";
      showPanel(`
        <p class="game-panel-kicker">${checkpoint}/5 banderines</p>
        <h3>¡Se acabó el tiempo!</h3>
        <p>Consejo de dev: suelta el giro antes de llegar. Las esferas derrapan.</p>
        <button class="btn btn-primary" type="button" data-action="start">Reintentar</button>
      `);
    }

    panel.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "start") start();
      if (action === "debug") options.onDebug?.();
    });

    /* ----- Controles ----- */

    const keyMap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };

    function onKey(event) {
      const dir = keyMap[event.code];
      if (dir) {
        input[dir] = event.type === "keydown";
        event.preventDefault();
        return;
      }
      if (event.type === "keydown" && (event.code === "Space" || event.code === "Enter") && state === "intro") {
        event.preventDefault();
        start();
      }
    }

    function bindHold(element, dir) {
      const down = (event) => {
        event.preventDefault();
        input[dir] = true;
        element.classList?.add("is-pressed");
      };
      const up = () => {
        input[dir] = false;
        element.classList?.remove("is-pressed");
      };
      element.addEventListener("pointerdown", down);
      element.addEventListener("pointerup", up);
      element.addEventListener("pointerleave", up);
      element.addEventListener("pointercancel", up);
      return () => {
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("pointerup", up);
        element.removeEventListener("pointerleave", up);
        element.removeEventListener("pointercancel", up);
      };
    }

    const unbinders = (options.touchButtons || []).map((button) => bindHold(button, button.dataset.steer === "-1" ? "left" : "right"));

    // Tocar la mitad izquierda/derecha del lienzo también gira
    function onCanvasPointer(event) {
      if (state !== "play") return;
      const rect = canvas.getBoundingClientRect();
      const isLeft = event.clientX - rect.left < rect.width / 2;
      const pressed = event.type === "pointerdown" || (event.type === "pointermove" && event.buttons);
      input.left = pressed && isLeft;
      input.right = pressed && !isLeft;
    }

    canvas.tabIndex = 0;
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    canvas.addEventListener("pointerdown", onCanvasPointer);
    canvas.addEventListener("pointermove", onCanvasPointer);
    canvas.addEventListener("pointerup", onCanvasPointer);

    /* ----- Física ----- */

    function update(dt) {
      if (state === "play") {
        elapsed += dt;
        if (elapsed >= TIME_LIMIT) {
          elapsed = TIME_LIMIT;
          lose();
        }

        const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        car.speed = Math.min(MAX_SPEED, car.speed + 420 * dt);
        car.angle += steer * 3.3 * dt * Math.min(1, car.speed / 120);

        // El "agarre" arrastra la velocidad hacia donde mira el coche: derrape de esfera
        const grip = 1 - Math.pow(0.02, dt);
        const targetVx = Math.cos(car.angle) * car.speed;
        const targetVy = Math.sin(car.angle) * car.speed;
        car.vx += (targetVx - car.vx) * grip;
        car.vy += (targetVy - car.vy) * grip;
        car.x += car.vx * dt;
        car.y += car.vy * dt;

        emitSmoke(dt, steer);
        collide();

        const target = CHECKPOINTS[checkpoint];
        if (Math.hypot(car.x - target.x, car.y - target.y) < CAR_RADIUS + 24) {
          burst(target.x, target.y);
          checkpoint += 1;
          if (checkpoint === CHECKPOINTS.length) win();
        }
      } else if (state === "reveal" || state === "won") {
        revealT = Math.min(1, revealT + dt / 1.2);
        car.vx *= 0.96;
        car.vy *= 0.96;
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        collide();
      }

      particles.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
        p.life -= dt;
      });
      particles = particles.filter((p) => p.life > 0);

      smoke.forEach((puff) => {
        puff.life -= dt;
        puff.x += puff.vx * dt;
        puff.y += puff.vy * dt;
      });
      smoke = smoke.filter((puff) => puff.life > 0);
    }

    // Humo sutil en las ruedas traseras solo cuando el coche derrapa
    function emitSmoke(dt, steer) {
      if (reduceMotion) return;
      const speed = Math.hypot(car.vx, car.vy);
      const slip = speed > 0 ? Math.abs(Math.sin(Math.atan2(car.vy, car.vx) - car.angle)) : 0;
      smokeTimer -= dt;
      if (steer === 0 || speed < 140 || slip < 0.12 || smokeTimer > 0 || smoke.length > 40) return;
      smokeTimer = 0.045;
      const back = -16;
      [-9, 9].forEach((side) => {
        const x = car.x + Math.cos(car.angle) * back - Math.sin(car.angle) * side;
        const y = car.y + Math.sin(car.angle) * back + Math.cos(car.angle) * side;
        smoke.push({ x, y, vx: -car.vx * 0.06 + (Math.random() - 0.5) * 12, vy: -car.vy * 0.06 + (Math.random() - 0.5) * 12, life: 0.45, max: 0.45 });
      });
    }

    function drawSmoke() {
      smoke.forEach((puff) => {
        const t = 1 - puff.life / puff.max;
        ctx.globalAlpha = 0.16 * (1 - t);
        ctx.fillStyle = "#8a7466";
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, 3 + t * 7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function collide() {
      const min = 22 + CAR_RADIUS;
      if (car.x < min) { car.x = min; car.vx = Math.abs(car.vx) * 0.5; bump(); }
      if (car.x > W - min) { car.x = W - min; car.vx = -Math.abs(car.vx) * 0.5; bump(); }
      if (car.y < min) { car.y = min; car.vy = Math.abs(car.vy) * 0.5; bump(); }
      if (car.y > H - min) { car.y = H - min; car.vy = -Math.abs(car.vy) * 0.5; bump(); }

      CONES.forEach((cone) => {
        const dx = car.x - cone.x;
        const dy = car.y - cone.y;
        const dist = Math.hypot(dx, dy);
        const overlap = CAR_RADIUS + CONE_RADIUS - dist;
        if (overlap > 0 && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          car.x += nx * overlap;
          car.y += ny * overlap;
          const dot = car.vx * nx + car.vy * ny;
          if (dot < 0) {
            car.vx -= 1.6 * dot * nx;
            car.vy -= 1.6 * dot * ny;
            bump();
          }
        }
      });
    }

    function bump() {
      if (state === "play") car.speed *= 0.55;
    }

    function burst(x, y) {
      if (reduceMotion) return;
      for (let i = 0; i < 16; i += 1) {
        const a = (Math.PI * 2 * i) / 16;
        particles.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 80, life: 0.6 });
      }
    }

    /* ----- Dibujo ----- */

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    }

    function drawArena() {
      ctx.fillStyle = COLORS.cream;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(98, 55, 34, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Muro con bordillo
      ctx.lineWidth = 12;
      ctx.strokeStyle = COLORS.brown;
      roundRect(16, 16, W - 32, H - 32, 20);
      ctx.stroke();
      ctx.setLineDash([18, 18]);
      ctx.strokeStyle = COLORS.yellow;
      ctx.lineWidth = 5;
      roundRect(16, 16, W - 32, H - 32, 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Línea de salida
      ctx.fillStyle = COLORS.ink;
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(58 + i * 8, 400 - (i % 2) * 8, 8, 8);
        ctx.fillRect(58 + i * 8, 408 - ((i + 1) % 2) * 8, 8, 8);
      }
    }

    function drawCheckpoints(time) {
      CHECKPOINTS.forEach((cp, index) => {
        if (index < checkpoint) return;
        const isCurrent = index === checkpoint;
        const pulse = isCurrent && !reduceMotion ? Math.sin(time * 6) * 3 : 0;
        ctx.globalAlpha = isCurrent ? 1 : 0.25;

        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 24 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? "rgba(255, 236, 144, 0.7)" : "transparent";
        ctx.fill();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = COLORS.brown;
        ctx.stroke();
        ctx.setLineDash([]);

        // Banderín
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cp.x - 4, cp.y + 12);
        ctx.lineTo(cp.x - 4, cp.y - 16);
        ctx.stroke();
        ctx.fillStyle = COLORS.red;
        ctx.beginPath();
        ctx.moveTo(cp.x - 3, cp.y - 16);
        ctx.lineTo(cp.x + 13, cp.y - 10);
        ctx.lineTo(cp.x - 3, cp.y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = COLORS.ink;
        ctx.font = "700 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(index + 1), cp.x, cp.y + 26 + 12);
        ctx.globalAlpha = 1;
      });
    }

    function drawCones(revealed) {
      CONES.forEach((cone) => {
        ctx.fillStyle = "rgba(43, 23, 15, 0.15)";
        ctx.beginPath();
        ctx.ellipse(cone.x + 3, cone.y + 4, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ff8a3d";
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cone.x, cone.y - 15);
        ctx.lineTo(cone.x + 11, cone.y + 10);
        ctx.lineTo(cone.x - 11, cone.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.cream;
        ctx.fillRect(cone.x - 5, cone.y - 3, 10, 4);

        if (revealed > 0) {
          ctx.globalAlpha = revealed;
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = COLORS.debug;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cone.x, cone.y, CONE_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      });
    }

    function drawCar(revealed) {
      // Sombra
      ctx.fillStyle = "rgba(43, 23, 15, 0.18)";
      ctx.beginPath();
      ctx.ellipse(car.x + 4, car.y + 6, 22 * (1 - revealed) + 15 * revealed, 14 * (1 - revealed) + 15 * revealed, car.angle, 0, Math.PI * 2);
      ctx.fill();

      // La esfera de verdad (aparece al ganar)
      if (revealed > 0) {
        const gradient = ctx.createRadialGradient(car.x - 5, car.y - 5, 2, car.x, car.y, CAR_RADIUS);
        gradient.addColorStop(0, "#fff9d6");
        gradient.addColorStop(1, "#e6c14a");
        ctx.globalAlpha = revealed;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(car.x, car.y, CAR_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = COLORS.ink;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Carrocería (desaparece al ganar)
      const bodyAlpha = 1 - revealed;
      if (bodyAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = bodyAlpha;
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = COLORS.ink;
        [[-13, -14], [9, -14], [-13, 10], [9, 10]].forEach(([x, y]) => ctx.fillRect(x, y, 9, 4));
        ctx.fillStyle = COLORS.yellow;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2.5;
        roundRect(-21, -12, 42, 24, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.brown;
        roundRect(2, -9, 9, 18, 3);
        ctx.fill();
        ctx.fillStyle = "rgba(98, 55, 34, 0.55)";
        roundRect(-14, -8, 7, 16, 3);
        ctx.fill();
        ctx.fillStyle = COLORS.cream;
        ctx.fillRect(17, -9, 3, 5);
        ctx.fillRect(17, 4, 3, 5);
        ctx.restore();
      }

      // Collider esférico: siempre ha estado ahí
      const colliderAlpha = state === "play" ? 0 : revealed;
      if (colliderAlpha > 0) {
        ctx.globalAlpha = colliderAlpha;
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = COLORS.debug;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(car.x, car.y, CAR_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "700 11px 'JetBrains Mono', monospace";
        const label = `SphereCollider r=${CAR_RADIUS}`;
        const width = ctx.measureText(label).width + 10;
        const lx = Math.min(W - width - 8, Math.max(8, car.x - width / 2));
        const ly = car.y - CAR_RADIUS - 28;
        ctx.fillStyle = COLORS.debug;
        roundRect(lx, ly, width, 17, 4);
        ctx.fill();
        ctx.fillStyle = "#052e12";
        ctx.textAlign = "left";
        ctx.fillText(label, lx + 5, ly + 12.5);
        ctx.globalAlpha = 1;
      }
    }

    function drawHud() {
      if (state !== "play" && state !== "reveal") return;
      const remaining = Math.max(0, TIME_LIMIT - elapsed);
      ctx.font = "800 20px 'Bricolage Grotesque', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = COLORS.ink;
      roundRect(30, 28, 104, 34, 17);
      ctx.fill();
      ctx.fillStyle = remaining < 5 ? "#ff9b9e" : COLORS.yellow;
      ctx.fillText(`⏱ ${format(remaining)}`, 44, 51);

      ctx.fillStyle = COLORS.ink;
      roundRect(W - 124, 28, 94, 34, 17);
      ctx.fill();
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText(`🚩 ${checkpoint}/5`, W - 110, 51);
    }

    function drawParticles() {
      particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life / 0.6);
        ctx.fillStyle = COLORS.yellow;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    function render(time) {
      const revealed = state === "reveal" || state === "won" ? easeOut(revealT) : 0;
      drawArena();
      drawCheckpoints(time);
      drawCones(revealed);
      drawSmoke();
      drawCar(revealed);
      drawParticles();
      drawHud();

      if (state === "intro" || state === "lost" || state === "won") {
        ctx.fillStyle = "rgba(255, 250, 240, 0.35)";
        ctx.fillRect(0, 0, W, H);
      }
    }

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      update(dt);
      render(now / 1000);
      raf = requestAnimationFrame(frame);
    }

    intro();
    raf = requestAnimationFrame(frame);

    return {
      destroy() {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        canvas.removeEventListener("pointerdown", onCanvasPointer);
        canvas.removeEventListener("pointermove", onCanvasPointer);
        canvas.removeEventListener("pointerup", onCanvasPointer);
        unbinders.forEach((unbind) => unbind());
        panel.remove();
      }
    };
  }

  window.CentusGame = { create };
})();
