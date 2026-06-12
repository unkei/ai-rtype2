(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const waveEl = document.getElementById("wave");
  const shieldEl = document.getElementById("shield");
  const chargeEl = document.getElementById("charge");
  const overlay = document.getElementById("overlay");
  const startButton = document.getElementById("startButton");
  const stick = document.getElementById("stick");
  const touchFire = document.getElementById("touchFire");
  const touchCharge = document.getElementById("touchCharge");

  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const bullets = [];
  const beams = [];
  const enemies = [];
  const particles = [];
  const stars = [];
  const pickups = [];
  const input = { x: 0, y: 0, fire: false, charge: false, pausePressed: false };
  const touch = { fire: false, charge: false };
  const player = { x: 100, y: H / 2, r: 16, speed: 300, shield: 100, invuln: 0, charge: 0, fireCd: 0 };
  const state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    wave: 1,
    spawn: 0,
    time: 0,
    last: 0,
    bossTimer: 34,
    bossAlive: false
  };

  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.35 + Math.random() * 1.5,
      size: 1 + Math.random() * 2
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function resetGame() {
    bullets.length = 0;
    beams.length = 0;
    enemies.length = 0;
    particles.length = 0;
    pickups.length = 0;
    Object.assign(player, { x: 100, y: H / 2, shield: 100, invuln: 1.2, charge: 0, fireCd: 0 });
    Object.assign(state, {
      running: true,
      paused: false,
      gameOver: false,
      score: 0,
      wave: 1,
      spawn: 0.7,
      time: 0,
      last: performance.now(),
      bossTimer: 34,
      bossAlive: false
    });
    overlay.hidden = true;
    requestAnimationFrame(frame);
  }

  function spawnEnemy() {
    const kindRoll = Math.random();
    const wave = state.wave;
    if (state.bossTimer <= 0 && !state.bossAlive) {
      enemies.push({ kind: "core", x: W + 82, y: H / 2, r: 48, hp: 34 + wave * 8, speed: 58, phase: 0, shot: 1.2 });
      state.bossAlive = true;
      state.bossTimer = 40 + wave * 4;
      return;
    }

    if (kindRoll > 0.82) {
      enemies.push({ kind: "turret", x: W + 30, y: random(70, H - 70), r: 20, hp: 5 + wave, speed: 90 + wave * 8, phase: random(0, 6), shot: 1.4 });
    } else if (kindRoll > 0.55) {
      enemies.push({ kind: "drone", x: W + 25, y: random(50, H - 50), r: 15, hp: 2 + Math.floor(wave / 2), speed: 145 + wave * 12, phase: random(0, 6) });
    } else {
      enemies.push({ kind: "scout", x: W + 25, y: random(45, H - 45), r: 13, hp: 1 + Math.floor(wave / 3), speed: 190 + wave * 14, phase: random(0, 6) });
    }
  }

  function fireBullet() {
    if (player.fireCd > 0) return;
    bullets.push({ x: player.x + 18, y: player.y - 6, vx: 570, r: 4, damage: 1 });
    bullets.push({ x: player.x + 18, y: player.y + 7, vx: 570, r: 4, damage: 1 });
    player.fireCd = 0.16;
  }

  function fireBeam() {
    if (player.charge < 100) return;
    beams.push({ x: player.x + 18, y: player.y, life: 0.22, damage: 10 + state.wave * 2 });
    player.charge = 0;
    burst(player.x + 40, player.y, "#5ee1c5", 18);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const a = random(0, Math.PI * 2);
      const s = random(55, 240);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random(0.25, 0.8), color });
    }
  }

  function hurtPlayer(amount) {
    if (player.invuln > 0 || state.gameOver) return;
    player.shield = clamp(player.shield - amount, 0, 100);
    player.invuln = 0.75;
    burst(player.x, player.y, "#ff6978", 22);
    if (player.shield <= 0) {
      state.gameOver = true;
      state.running = false;
      overlay.hidden = false;
      overlay.querySelector("h1").textContent = "Mission Failed";
      overlay.querySelector("p").textContent = `Score ${state.score} / Wave ${state.wave}`;
      startButton.textContent = "Retry";
    }
  }

  function updateInput() {
    let x = 0;
    let y = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;
    input.fire = keys.has("Space") || touch.fire || input.fire;
    input.charge = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.charge || input.charge;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(Boolean);
    if (pad) {
      const lx = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0;
      const ly = Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : 0;
      x += lx;
      y += ly;
      input.fire = input.fire || Boolean(pad.buttons[0] && pad.buttons[0].pressed);
      input.charge = input.charge || Boolean(pad.buttons[2] && pad.buttons[2].pressed);
      if (pad.buttons[9] && pad.buttons[9].pressed && !input.pausePressed) togglePause();
      input.pausePressed = Boolean(pad.buttons[9] && pad.buttons[9].pressed);
    }

    const len = Math.hypot(x + input.x, y + input.y);
    if (len > 1) {
      x = (x + input.x) / len;
      y = (y + input.y) / len;
    } else {
      x += input.x;
      y += input.y;
    }
    return { x, y };
  }

  function update(dt) {
    state.time += dt;
    state.bossTimer -= dt;
    player.invuln -= dt;
    player.fireCd -= dt;

    const move = updateInput();
    player.x = clamp(player.x + move.x * player.speed * dt, 32, W * 0.48);
    player.y = clamp(player.y + move.y * player.speed * dt, 34, H - 34);

    if (input.fire) fireBullet();
    if (input.charge) {
      player.charge = clamp(player.charge + dt * 44, 0, 100);
    } else if (player.charge >= 100) {
      fireBeam();
    } else {
      player.charge = clamp(player.charge - dt * 18, 0, 100);
    }

    state.spawn -= dt;
    if (state.spawn <= 0) {
      spawnEnemy();
      state.spawn = clamp(1.05 - state.wave * 0.05, 0.38, 1.05);
    }
    state.wave = 1 + Math.floor(state.score / 900);

    for (const star of stars) {
      star.x -= (40 + state.wave * 4) * star.z * dt;
      if (star.x < -5) {
        star.x = W + 5;
        star.y = Math.random() * H;
      }
    }

    for (const bullet of bullets) bullet.x += bullet.vx * dt;
    for (const beam of beams) beam.life -= dt;
    for (const enemy of enemies) {
      enemy.phase += dt;
      enemy.x -= enemy.speed * dt;
      if (enemy.kind === "drone") enemy.y += Math.sin(enemy.phase * 5) * 105 * dt;
      if (enemy.kind === "turret") {
        enemy.y += Math.sin(enemy.phase * 2.2) * 58 * dt;
        enemy.shot -= dt;
        if (enemy.shot <= 0) {
          enemy.shot = 1.5;
          enemies.push({ kind: "bolt", x: enemy.x - 20, y: enemy.y, r: 6, hp: 1, speed: 310, phase: 0, damage: 12 });
        }
      }
      if (enemy.kind === "core") {
        enemy.y = H / 2 + Math.sin(enemy.phase * 1.4) * 130;
        enemy.shot -= dt;
        if (enemy.shot <= 0) {
          enemy.shot = 0.9;
          for (let i = -1; i <= 1; i += 1) {
            enemies.push({ kind: "bolt", x: enemy.x - 48, y: enemy.y + i * 28, r: 7, hp: 1, speed: 250, phase: i * 0.35, damage: 16 });
          }
        }
      }
      if (enemy.kind === "bolt") enemy.y += Math.sin(enemy.phase + state.time * 6) * 22 * dt;
      enemy.y = clamp(enemy.y, 20, H - 20);
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }

    for (const pickup of pickups) {
      pickup.x -= 130 * dt;
      const d = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (d < pickup.r + player.r) {
        player.shield = clamp(player.shield + 18, 0, 100);
        pickup.used = true;
        burst(player.x, player.y, "#ffd166", 10);
      }
    }

    collide();
    cleanup();
    updateHud();
    input.fire = false;
    input.charge = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.charge;
  }

  function collide() {
    for (const bullet of bullets) {
      for (const enemy of enemies) {
        if (enemy.kind === "bolt" || bullet.dead) continue;
        if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.r + enemy.r) {
          bullet.dead = true;
          enemy.hp -= bullet.damage;
          burst(bullet.x, bullet.y, "#ecf5ff", 4);
        }
      }
    }

    for (const beam of beams) {
      for (const enemy of enemies) {
        if (enemy.kind === "bolt") continue;
        if (enemy.x > player.x && Math.abs(enemy.y - beam.y) < enemy.r + 18) {
          enemy.hp -= beam.damage;
          burst(enemy.x, enemy.y, "#5ee1c5", 5);
        }
      }
    }

    for (const enemy of enemies) {
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.dead = true;
        const value = enemy.kind === "core" ? 1200 : enemy.kind === "turret" ? 220 : 120;
        state.score += value;
        if (enemy.kind === "core") state.bossAlive = false;
        if (Math.random() < 0.14 || enemy.kind === "core") pickups.push({ x: enemy.x, y: enemy.y, r: 12 });
        burst(enemy.x, enemy.y, enemy.kind === "core" ? "#ffd166" : "#82aaff", enemy.kind === "core" ? 50 : 16);
      }
      const hit = Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.r + player.r;
      if (hit && !enemy.dead) {
        enemy.dead = true;
        hurtPlayer(enemy.damage || 20);
      }
    }
  }

  function cleanup() {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      if (bullets[i].dead || bullets[i].x > W + 20) bullets.splice(i, 1);
    }
    for (let i = beams.length - 1; i >= 0; i -= 1) {
      if (beams[i].life <= 0) beams.splice(i, 1);
    }
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      if (enemies[i].dead || enemies[i].x < -120) enemies.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      if (pickups[i].used || pickups[i].x < -20) pickups.splice(i, 1);
    }
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    waveEl.textContent = String(state.wave);
    shieldEl.textContent = String(Math.ceil(player.shield));
    chargeEl.textContent = String(Math.floor(player.charge));
  }

  function drawShip(x, y) {
    ctx.save();
    ctx.translate(x, y);
    if (player.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#d7ecff";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-18, -17);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-18, 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5ee1c5";
    ctx.fillRect(-8, -5, 18, 10);
    ctx.fillStyle = "#ff6978";
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-20, 8);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === "core") {
      ctx.fillStyle = "#29384d";
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = "#ff6978";
      ctx.beginPath();
      ctx.arc(-10, 0, 18 + Math.sin(state.time * 8) * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === "turret") {
      ctx.fillStyle = "#8257e5";
      ctx.fillRect(-18, -18, 36, 36);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-28, -5, 20, 10);
    } else if (enemy.kind === "bolt") {
      ctx.fillStyle = "#ff6978";
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = enemy.kind === "drone" ? "#82aaff" : "#5ee1c5";
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(14, -13);
      ctx.lineTo(8, 0);
      ctx.lineTo(14, 13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, W, H);
    sky.addColorStop(0, "#07101a");
    sky.addColorStop(0.55, "#0d1725");
    sky.addColorStop(1, "#1b1925");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      ctx.fillStyle = `rgba(236, 245, 255, ${0.22 + star.z * 0.32})`;
      ctx.fillRect(star.x, star.y, star.size * star.z, star.size);
    }

    ctx.strokeStyle = "rgba(94, 225, 197, 0.16)";
    ctx.lineWidth = 1;
    for (let x = (state.time * -35) % 80; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, H - 82);
      ctx.lineTo(x + 80, H - 42);
      ctx.stroke();
    }

    for (const bullet of bullets) {
      ctx.fillStyle = "#ecf5ff";
      ctx.fillRect(bullet.x - 1, bullet.y - 2, 18, 4);
      ctx.fillStyle = "#5ee1c5";
      ctx.fillRect(bullet.x + 14, bullet.y - 1, 8, 2);
    }

    for (const beam of beams) {
      ctx.globalAlpha = clamp(beam.life / 0.22, 0, 1);
      ctx.fillStyle = "#5ee1c5";
      ctx.fillRect(beam.x, beam.y - 10, W - beam.x, 20);
      ctx.fillStyle = "#ecf5ff";
      ctx.fillRect(beam.x, beam.y - 3, W - beam.x, 6);
      ctx.globalAlpha = 1;
    }

    for (const pickup of pickups) {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const enemy of enemies) drawEnemy(enemy);
    drawShip(player.x, player.y);

    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    if (state.paused) {
      ctx.fillStyle = "rgba(5, 11, 19, 0.58)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ecf5ff";
      ctx.font = "700 42px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Paused", W / 2, H / 2);
    }
  }

  function frame(now) {
    if (!state.running) return;
    const dt = Math.min((now - state.last) / 1000, 0.033);
    state.last = now;
    if (!state.paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
  }

  function setTouchVector(clientX, clientY) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const mag = Math.min(Math.hypot(dx, dy), 42);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * mag;
    const ky = Math.sin(angle) * mag;
    input.x = kx / 42;
    input.y = ky / 42;
    stick.style.setProperty("--knob-x", `${kx}px`);
    stick.style.setProperty("--knob-y", `${ky}px`);
  }

  function clearTouchVector() {
    input.x = 0;
    input.y = 0;
    stick.style.setProperty("--knob-x", "0px");
    stick.style.setProperty("--knob-y", "0px");
  }

  startButton.addEventListener("click", resetGame);
  window.addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "KeyP" && !event.repeat) togglePause();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("gamepadconnected", () => {
    overlay.querySelector("p").textContent = "GamePad connected. 左スティック、A、X、Start に対応。";
  });

  stick.addEventListener("pointerdown", (event) => {
    stick.setPointerCapture(event.pointerId);
    setTouchVector(event.clientX, event.clientY);
  });
  stick.addEventListener("pointermove", (event) => {
    if (stick.hasPointerCapture(event.pointerId)) setTouchVector(event.clientX, event.clientY);
  });
  stick.addEventListener("pointerup", clearTouchVector);
  stick.addEventListener("pointercancel", clearTouchVector);
  touchFire.addEventListener("pointerdown", () => {
    touch.fire = true;
  });
  touchFire.addEventListener("pointerup", () => {
    touch.fire = false;
  });
  touchFire.addEventListener("pointercancel", () => {
    touch.fire = false;
  });
  touchCharge.addEventListener("pointerdown", () => {
    touch.charge = true;
  });
  touchCharge.addEventListener("pointerup", () => {
    touch.charge = false;
  });
  touchCharge.addEventListener("pointercancel", () => {
    touch.charge = false;
  });

  draw();
  updateHud();
}());
