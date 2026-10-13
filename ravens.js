// Raven67 — flying ravens in the home hero.
// • A flock bursts out from behind the characters when the page loads (and when you come back to Home)
// • Now and then one to three ravens glide across the top of the hero
// Ravens fly over the RAVEN67 logo but behind the characters and text.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inner = document.querySelector(".r67-hero-inner");
  const art = document.querySelector(".hero-art");
  if (!inner || reduceMotion || !Element.prototype.animate) return;

  const layer = document.createElement("div");
  layer.className = "raven-layer";
  layer.setAttribute("aria-hidden", "true");
  inner.prepend(layer);

  const small = () => window.innerWidth < 720;
  const rand = (a, b) => a + Math.random() * (b - a);

  // Front-facing raven silhouette: broad wings with "fingered" tips, wedge tail. Wings flap up/down via CSS.
  const WING = "M2 -3 C10 -9 22 -12 34 -10 L42 -13 L39 -8 L47 -10 L42 -5 L50 -5 L43 -1 L49 1 L40 2 C29 3 15 4 2 5 Z";
  const BIRD_SVG = `<svg viewBox="-52 -26 104 52"><path class="rv-wing" d="${WING}"/><g transform="scale(-1,1)"><path class="rv-wing" d="${WING}"/></g><ellipse cx="0" cy="2" rx="5" ry="10"/><circle cx="0" cy="-8" r="4.2"/><path d="M-1.3 -6 L0 -2.5 L1.3 -6Z" fill="#2a1840"/><path d="M-3.5 10 L-6.5 21 L-2 18.5 L0 21.5 L2 18.5 L6.5 21 L3.5 10Z"/></svg>`;
  const FEATHER_SVG = `<svg viewBox="0 0 10 24"><path d="M5 0 C9 6 9 15 5 22 C1 15 1 6 5 0Z"/><path d="M5 2 L5 24" stroke="rgba(192,132,252,.6)" stroke-width=".7"/></svg>`;

  function makeBird(size, flap) {
    const bird = document.createElement("div");
    bird.className = "raven";
    bird.style.setProperty("--s", `${size}px`);
    bird.style.setProperty("--flap", `${flap}s`);
    bird.innerHTML = BIRD_SVG;
    // start each bird at a random point in its wingbeat
    bird.querySelectorAll(".rv-wing").forEach((w) => (w.style.animationDelay = `-${rand(0, flap)}s`));
    layer.appendChild(bird);
    return bird;
  }

  const pose = (x, y, heading, scale) => `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${heading}deg) scale(${scale})`;
  // front-facing birds don't spin; they bank (tilt) toward where they're heading
  const headingOf = (dx) => Math.max(-28, Math.min(28, dx * 0.06));

  // Point behind the characters' chests, in layer coordinates
  function origin() {
    const L = layer.getBoundingClientRect();
    if (art && art.offsetParent !== null) {
      const A = art.getBoundingClientRect();
      if (A.width) return { x: A.left - L.left + A.width / 2, y: A.top - L.top + A.height * 0.38 };
    }
    return { x: L.width / 2, y: L.height * 0.45 };
  }

  let lastBurst = -Infinity;
  function burst(count = small() ? 8 : 14) {
    const now = performance.now();
    if (now - lastBurst < 5000) return; // don't stack bursts
    lastBurst = now;
    const o = origin();

    for (let i = 0; i < count; i++) {
      const size = small() ? rand(34, 56) : rand(46, 88);
      const bird = makeBird(size, rand(0.2, 0.3));
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4; // mostly up and outward
      const dist = rand(360, 820) * (small() ? 0.6 : 1);
      const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
      const bend = rand(-0.35, 0.35); // curved path
      const mx = dx * 0.45 - dy * bend, my = dy * 0.45 + dx * bend;
      const sx = o.x + rand(-30, 30), sy = o.y + rand(-30, 30);
      const h1 = headingOf(mx), h2 = headingOf(dx - mx);

      const anim = bird.animate([
        { transform: pose(sx, sy, h1, 0.25), opacity: 0 },
        { transform: pose(sx + mx * 0.25, sy + my * 0.25, h1, 0.7), opacity: 1, offset: 0.14 },
        { transform: pose(sx + mx, sy + my, (h1 + h2) / 2, 1), opacity: 1, offset: 0.55 },
        { transform: pose(sx + dx, sy + dy, h2, 1.25), opacity: 0 },
      ], { duration: rand(1900, 3300), delay: i * 45 + rand(0, 220), easing: "cubic-bezier(.2,.6,.3,1)", fill: "backwards" });
      anim.onfinish = () => bird.remove();
    }

    // a few feathers drifting down
    for (let i = 0; i < (small() ? 4 : 8); i++) {
      const f = document.createElement("div");
      f.className = "raven-feather";
      f.innerHTML = FEATHER_SVG;
      layer.appendChild(f);
      const x = o.x + rand(-140, 140), y = o.y + rand(-110, 10);
      const fall = rand(140, 260), sway = rand(-60, 60), spin = rand(160, 520) * (Math.random() < 0.5 ? -1 : 1);
      const anim = f.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0deg) scale(.6)`, opacity: 0 },
        { opacity: 0.9, offset: 0.15 },
        { transform: `translate(${x + sway}px, ${y + fall * 0.5}px) rotate(${spin * 0.5}deg) scale(1)`, offset: 0.5 },
        { transform: `translate(${x - sway * 0.5}px, ${y + fall}px) rotate(${spin}deg) scale(1)`, opacity: 0 },
      ], { duration: rand(2600, 4200), delay: 250 + rand(0, 500), easing: "ease-in-out", fill: "backwards" });
      anim.onfinish = () => f.remove();
    }
  }

  // One to three ravens gliding across the top part of the hero
  function flyby() {
    const W = layer.clientWidth, H = layer.clientHeight;
    if (!W || !H) return;
    const fromLeft = Math.random() < 0.5;
    const n = Math.random() < 0.55 ? 1 : Math.random() < 0.6 ? 2 : 3;
    const baseY = rand(H * 0.06, H * 0.42);

    for (let i = 0; i < n; i++) {
      const size = small() ? rand(30, 42) : rand(38, 60);
      const bird = makeBird(size, rand(0.38, 0.5));
      const y = baseY + i * rand(18, 34), drift = rand(-70, 50);
      const x0 = fromLeft ? -80 - i * 40 : W + 80 + i * 40;
      const x1 = fromLeft ? W + 80 : -80;
      const heading = fromLeft ? 8 : -8; // slight bank in the flying direction
      const bob = rand(14, 26);
      const anim = bird.animate([
        { transform: pose(x0, y, heading, 1) },
        { transform: pose(x0 + (x1 - x0) * 0.25, y + drift * 0.25 - bob, heading - 6 * Math.sign(heading), 1), offset: 0.25 },
        { transform: pose(x0 + (x1 - x0) * 0.5, y + drift * 0.5 + bob, heading + 4 * Math.sign(heading), 1), offset: 0.5 },
        { transform: pose(x0 + (x1 - x0) * 0.75, y + drift * 0.75 - bob, heading - 6 * Math.sign(heading), 1), offset: 0.75 },
        { transform: pose(x1, y + drift, heading, 1) },
      ], { duration: rand(7000, 10000) * (small() ? 0.7 : 1), delay: i * rand(250, 600), easing: "linear", fill: "backwards" });
      anim.onfinish = () => bird.remove();
    }
  }

  const homeVisible = () => !document.hidden && layer.offsetParent !== null;

  // Burst right after the characters spawn in
  setTimeout(() => { if (homeVisible()) burst(); }, 900);

  // Gliders every 10–16 seconds while Home is on screen
  (function loop() {
    setTimeout(() => { if (homeVisible()) flyby(); loop(); }, rand(10000, 16000));
  })();
  setTimeout(() => { if (homeVisible()) flyby(); }, 4500);

  // Burst again when returning to the Home tab
  window.addEventListener("raven67:tabchange", (e) => {
    if (e.detail?.tab === "home") setTimeout(() => { if (homeVisible()) burst(); }, 350);
  });
})();
