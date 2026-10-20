"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SPOTIFY_TRACK_ID = "56wDFSIa9Tr7zbEXUVMwjP";
const SPOTIFY_URL = `https://open.spotify.com/track/${SPOTIFY_TRACK_ID}`;
const YOUTUBE_URL = `https://www.youtube.com/results?search_query=${encodeURIComponent("fellow fellow ดาวหางฮัลเลย์")}`;
// Spotify doesn't expose its audio to other pages, so the scene follows a simulated beat
const BEAT_SECONDS = 0.78;

type SpotifyController = {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  destroy: () => void;
  addListener: (event: string, cb: (e: { data: { isPaused: boolean; position: number; duration: number } }) => void) => void;
};
type SpotifyIFrameAPI = {
  createController: (
    el: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    cb: (controller: SpotifyController) => void,
  ) => void;
};
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    __spotifyIFrameAPI?: SpotifyIFrameAPI;
  }
}

function loadSpotifyIFrameAPI(): Promise<SpotifyIFrameAPI> {
  if (window.__spotifyIFrameAPI) return Promise.resolve(window.__spotifyIFrameAPI);
  return new Promise((resolve) => {
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      window.__spotifyIFrameAPI = api;
      prev?.(api);
      resolve(api);
    };
    if (!document.querySelector('script[src*="embed/iframe-api"]')) {
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

const STORY: { text: string; accent?: boolean }[] = [
  { text: "คืนนี้ท้องฟ้าเงียบกว่าทุกคืน" },
  { text: "แต่ในใจคุณ… กลับไม่เงียบเลย" },
  { text: "คุณกำลังคิดถึงใครบางคนอยู่ละสิ", accent: true },
  { text: "ใครสักคน ที่ทำให้คืนธรรมดา ดูสว่างขึ้นมา" },
  { text: "ถ้าคิดถึงเขา… ลองมองขึ้นไปบนฟ้าดูสิ" },
];
const STORY_LINE_MS = 3600;

type Star = { x: number; y: number; r: number; phase: number; speed: number; hue: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

export default function CometScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const embedHostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const playingRef = useRef(false);
  const wantPlayRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [intro, setIntro] = useState<"show" | "leaving" | "gone">("show");
  const [storyIdx, setStoryIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);

  // ---------- Spotify ----------
  useEffect(() => {
    let cancelled = false;
    const host = embedHostRef.current;
    if (!host) return;
    loadSpotifyIFrameAPI().then((api) => {
      if (cancelled) return;
      const el = document.createElement("div");
      host.appendChild(el);
      api.createController(el, { uri: `spotify:track:${SPOTIFY_TRACK_ID}`, width: "100%", height: 80 }, (controller) => {
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
        controller.addListener("ready", () => {
          if (wantPlayRef.current) controller.play();
        });
        controller.addListener("playback_update", (e) => {
          const isPlaying = !e.data.isPaused;
          playingRef.current = isPlaying;
          setPlaying(isPlaying);
          if (isPlaying) setNeedsTap(false);
        });
      });
    });
    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      host.innerHTML = "";
    };
  }, []);

  const startMusic = useCallback(() => {
    wantPlayRef.current = true;
    controllerRef.current?.play();
    // If the browser blocks autoplay inside the embed, ask for one tap on Spotify's own button
    window.setTimeout(() => {
      if (!playingRef.current) setNeedsTap(true);
    }, 3500);
  }, []);

  const togglePlay = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (playingRef.current) controller.pause();
    else startMusic();
  }, [startMusic]);

  const enterScene = useCallback(() => {
    if (intro !== "show") return;
    setIntro("leaving");
    window.setTimeout(() => setIntro("gone"), 1400);
    window.setTimeout(() => setStoryIdx(0), 900);
  }, [intro]);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setStoryIdx(null);
    setRevealed(true);
    startMusic();
  }, [startMusic]);

  const lastLine = storyIdx === STORY.length - 1;

  const advanceStory = useCallback(() => {
    setStoryIdx((i) => (i === null || i >= STORY.length - 1 ? i : i + 1));
  }, []);

  useEffect(() => {
    if (storyIdx === null || storyIdx >= STORY.length - 1) return;
    const t = window.setTimeout(advanceStory, STORY_LINE_MS);
    return () => window.clearTimeout(t);
  }, [storyIdx, advanceStory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (intro === "show" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        enterScene();
        return;
      }
      if (storyIdx !== null) {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          if (lastLine) reveal();
          else advanceStory();
        } else if (e.code === "Escape") {
          reveal();
        }
        return;
      }
      if (e.code === "Space" && revealedRef.current) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, enterScene, intro, storyIdx, lastLine, reveal, advanceStory]);

  // ---------- Scene ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let backHill: Path2D = new Path2D();
    let frontHill: Path2D = new Path2D();
    const particles: Particle[] = [];
    const meteors: Meteor[] = [];
    const freq = new Uint8Array(128);
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let raf = 0;
    let last = performance.now();
    let cometT = -0.1;
    let cometSpeed = 0.016;
    let smoothEnergy = 0;
    const trail: { x: number; y: number }[] = [];

    const buildHill = (baseY: number, amp: number, seed: number) => {
      const p = new Path2D();
      p.moveTo(0, h);
      p.lineTo(0, baseY);
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        const y =
          baseY -
          Math.sin(i * 0.11 + seed) * amp -
          Math.sin(i * 0.037 + seed * 2.3) * amp * 1.6 -
          Math.sin(i * 0.29 + seed * 0.7) * amp * 0.25;
        p.lineTo(x, y);
      }
      p.lineTo(w, h);
      p.closePath();
      return p;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.floor((w * h) / 2600);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: Math.random() ** 2.2 * 1.8 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 2,
        hue: [210, 220, 45, 190, 280][Math.floor(Math.random() * 5)],
      }));
      backHill = buildHill(h * 0.8, h * 0.025, 1.7);
      frontHill = buildHill(h * 0.9, h * 0.018, 4.2);
    };

    const cometPos = (t: number, time: number) => {
      // Long arc from the lower-left, peaking high in the sky, setting to the right,
      // with a slow floating sway so it never moves on a rigid track
      const x = -0.15 * w + t * 1.3 * w + Math.sin(time * 0.31) * w * 0.012;
      const y =
        h * 0.7 -
        Math.sin(t * Math.PI) * h * 0.5 +
        Math.sin(time * 0.53 + 1.3) * h * 0.018 +
        Math.sin(time * 0.17) * h * 0.012;
      return { x, y };
    };

    const readAudio = (time: number) => {
      if (playingRef.current) {
        // Simulated spectrum: a soft kick on every beat, a swaying mid range and shimmering highs
        const phase = (time % BEAT_SECONDS) / BEAT_SECONDS;
        const kick = Math.exp(-phase * 5);
        const bar = Math.floor(time / (BEAT_SECONDS * 4));
        const swell = 0.55 + 0.45 * Math.sin(time * 0.35 + bar * 0.9);
        for (let i = 0; i < freq.length; i++) {
          const f = i / freq.length;
          const low = kick * Math.exp(-f * 18) * 1.1;
          const midBand = swell * 0.6 * Math.exp(-((f - 0.25) ** 2) / 0.06) * (0.75 + 0.25 * Math.sin(time * 3.1 + i * 0.7));
          const high = 0.42 * Math.exp(-f * 1.8) * (0.5 + 0.5 * Math.sin(time * 7.3 + i * 1.9)) * (0.6 + kick * 0.4);
          const target = Math.min(1, low + midBand + high) * 255;
          freq[i] += (target - freq[i]) * 0.35;
        }
      } else {
        for (let i = 0; i < freq.length; i++) freq[i] *= 0.92;
      }
      const avg = (a: number, b: number) => {
        let sum = 0;
        for (let i = a; i < b; i++) sum += freq[i];
        return sum / (b - a) / 255;
      };
      bass += (avg(0, 6) - bass) * 0.25;
      mid += (avg(6, 40) - mid) * 0.2;
      treble += (avg(40, 110) - treble) * 0.2;
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const time = now / 1000;
      readAudio(time);
      const energy = bass * 0.5 + mid * 0.35 + treble * 0.15;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#03040f");
      sky.addColorStop(0.45, "#0a1238");
      sky.addColorStop(0.8, `rgb(${40 + energy * 40}, ${30 + energy * 20}, ${90 + energy * 40})`);
      sky.addColorStop(1, "#1d1440");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Nebula glows
      ctx.globalCompositeOperation = "lighter";
      const nebulas: [number, number, number, string][] = [
        [0.22, 0.3, 0.45, "rgba(120, 70, 200, "],
        [0.78, 0.22, 0.4, "rgba(40, 120, 220, "],
        [0.55, 0.62, 0.5, "rgba(220, 90, 160, "],
      ];
      for (const [nx, ny, nr, col] of nebulas) {
        const r = Math.max(w, h) * nr * (1 + bass * 0.15);
        const g = ctx.createRadialGradient(nx * w, ny * h, 0, nx * w, ny * h, r);
        g.addColorStop(0, `${col}${0.07 + mid * 0.12})`);
        g.addColorStop(1, `${col}0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Stars
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase);
        const a = Math.min(1, 0.25 + tw * 0.6 + treble * 0.8);
        const r = s.r * (1 + treble * 0.9);
        ctx.fillStyle = `hsla(${s.hue}, 80%, 88%, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.5) {
          ctx.strokeStyle = `hsla(${s.hue}, 80%, 90%, ${a * 0.35})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - r * 4, s.y);
          ctx.lineTo(s.x + r * 4, s.y);
          ctx.moveTo(s.x, s.y - r * 4);
          ctx.lineTo(s.x, s.y + r * 4);
          ctx.stroke();
        }
      }

      // Shooting stars
      if (Math.random() < 0.004 + energy * 0.03) {
        meteors.push({
          x: Math.random() * w * 0.9 + w * 0.1,
          y: Math.random() * h * 0.35,
          vx: -(500 + Math.random() * 500),
          vy: 220 + Math.random() * 260,
          life: 1,
        });
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= dt * 1.4;
        if (m.life <= 0) {
          meteors.splice(i, 1);
          continue;
        }
        const tail = 0.12;
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tail, m.y - m.vy * tail);
        g.addColorStop(0, `rgba(255,255,255,${m.life})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * tail, m.y - m.vy * tail);
        ctx.stroke();
      }

      // Comet — speed eases toward the music instead of jumping frame to frame
      smoothEnergy += (energy - smoothEnergy) * Math.min(1, dt * 1.5);
      const targetSpeed = 0.014 + smoothEnergy * 0.018;
      cometSpeed += (targetSpeed - cometSpeed) * Math.min(1, dt * 0.8);
      if (revealedRef.current) cometT += dt * cometSpeed;
      if (cometT > 1.1) {
        cometT = -0.1;
        trail.length = 0;
      }
      const head = cometPos(cometT, time);
      const ahead = cometPos(cometT + 0.004, time);
      let dx = ahead.x - head.x;
      let dy = ahead.y - head.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const nx = -dy;
      const ny = dx;

      // Ion tail — a soft ribbon that follows the comet's own recent path
      trail.unshift({ x: head.x, y: head.y });
      const maxTrail = Math.floor(70 + smoothEnergy * 60);
      if (trail.length > maxTrail) trail.length = maxTrail;
      ctx.lineCap = "round";
      for (let i = trail.length - 1; i > 0; i--) {
        const k = 1 - i / trail.length;
        const a = trail[i];
        const b = trail[i - 1];
        // older points drift gently, like gas blown by solar wind
        a.x -= dx * 12 * dt;
        a.y -= dy * 12 * dt - 6 * dt;
        ctx.strokeStyle = `rgba(${130 + k * 100}, ${190 + k * 50}, 255, ${k * k * (0.45 + bass * 0.4)})`;
        ctx.lineWidth = 1 + k * (7 + bass * 10);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Dust tail particles
      const emit = Math.floor(3 + smoothEnergy * 14);
      for (let i = 0; i < emit; i++) {
        const speed = 30 + Math.random() * 90 + bass * 140;
        const jitter = (Math.random() - 0.5) * (0.6 + mid);
        particles.push({
          x: head.x + (Math.random() - 0.5) * 6,
          y: head.y + (Math.random() - 0.5) * 6,
          vx: (-dx + nx * jitter) * speed,
          vy: (-dy + ny * jitter) * speed + 8,
          life: 0,
          max: 1.2 + Math.random() * 1.6,
          size: 0.8 + Math.random() * 2.2,
        });
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) {
          particles.splice(i, 1);
          continue;
        }
        // gentle swirl so the dust tail flows instead of shooting in straight lines
        p.vx += Math.sin(p.y * 0.02 + time * 1.3) * 18 * dt;
        p.vy += Math.cos(p.x * 0.02 + time * 1.1) * 18 * dt + 10 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        const k = 1 - p.life / p.max;
        ctx.fillStyle = `hsla(${35 + (1 - k) * 160}, 95%, ${70 + k * 20}%, ${k * 0.55})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + k), 0, Math.PI * 2);
        ctx.fill();
      }

      // Coma + nucleus
      const coma = 24 + bass * 32 + Math.sin(time * 2.1) * 2;
      const cg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, coma);
      cg.addColorStop(0, "rgba(255,255,255,1)");
      cg.addColorStop(0.15, "rgba(220,245,255,0.9)");
      cg.addColorStop(0.45, "rgba(120,200,255,0.3)");
      cg.addColorStop(1, "rgba(80,140,255,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(head.x, head.y, coma, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // Horizon glow
      const hg = ctx.createLinearGradient(0, h * 0.7, 0, h);
      hg.addColorStop(0, "rgba(255,120,180,0)");
      hg.addColorStop(1, `rgba(255,120,180,${0.12 + bass * 0.25})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      // Back hill
      ctx.fillStyle = "#0d0b26";
      ctx.fill(backHill);

      // Frequency bars rising behind the front hill
      const bars = 64;
      const bw = w / bars;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((Math.abs(i - bars / 2) / (bars / 2)) * 90);
        const v = freq[idx] / 255;
        const bh = v * h * 0.5;
        const g = ctx.createLinearGradient(0, h, 0, h - bh - h * 0.1);
        g.addColorStop(0, `hsla(${200 + v * 120}, 90%, 65%, ${0.05 + v * 0.35})`);
        g.addColorStop(1, `hsla(${200 + v * 120}, 90%, 65%, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 1, h - h * 0.1 - bh, bw - 2, bh + h * 0.1);
      }
      ctx.globalCompositeOperation = "source-over";

      // Front hill
      ctx.fillStyle = "#05040f";
      ctx.fill(frontHill);

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main className={`scene ${revealed ? "is-revealed" : "is-story"}`}>
      <canvas ref={canvasRef} className="sky" aria-hidden />

      <header className="title">
        <p className="eyebrow">Halley&apos;s Comet · 1P/Halley</p>
        <h1>ดาวหางฮัลเลย์</h1>
        <p className="artist">fellow fellow</p>
      </header>

      <section className={`player ${playing ? "is-playing" : ""}`} aria-label="เครื่องเล่นเพลง Spotify">
        <div ref={embedHostRef} className="embed" />
      </section>

      <footer className="credit">
        <span>
          เพลง <b>ดาวหางฮัลเลย์</b> — <b>fellow fellow</b> · ลิขสิทธิ์เพลงเป็นของศิลปินและต้นสังกัด
          · เล่นผ่าน Spotify
        </span>
        <span className="credit-links">
          ฟังเพลงต้นฉบับ:{" "}
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
            YouTube
          </a>{" "}
          ·{" "}
          <a href={SPOTIFY_URL} target="_blank" rel="noopener noreferrer">
            Spotify
          </a>
        </span>
      </footer>

      {needsTap && intro === "gone" && (
        <p className="hint">กดปุ่ม ▶ บนการ์ด Spotify ด้านล่างเพื่อเริ่มเพลง</p>
      )}

      {storyIdx !== null && (
        <div className="story" onClick={lastLine ? undefined : advanceStory}>
          <p key={storyIdx} className={`story-line ${STORY[storyIdx].accent ? "is-accent" : ""}`}>
            {STORY[storyIdx].text}
          </p>
          {lastLine && (
            <button className="story-go" onClick={reveal}>
              มองขึ้นไปบนฟ้า ✦
            </button>
          )}
          <div className="story-dots" aria-hidden>
            {STORY.map((_, i) => (
              <span key={i} className={i <= storyIdx ? "on" : ""} />
            ))}
          </div>
          {!lastLine && (
            <button
              className="story-skip"
              onClick={(e) => {
                e.stopPropagation();
                reveal();
              }}
            >
              ข้าม →
            </button>
          )}
        </div>
      )}

      {intro !== "gone" && (
        <div
          className={`intro ${intro === "leaving" ? "is-leaving" : ""}`}
          onClick={enterScene}
          role="button"
          tabIndex={0}
          aria-label="แตะเพื่อเข้าสู่ฉาก"
        >
          <div className="intro-stars" aria-hidden />
          <div className="intro-core">
            <div className="intro-orbit" aria-hidden>
              <span className="intro-comet" />
            </div>
            <h2 className="intro-logo" aria-label="Pma.Dev">
              {"Pma.Dev".split("").map((ch, i) => (
                <span key={i} style={{ animationDelay: `${0.25 + i * 0.09}s` }} aria-hidden>
                  {ch}
                </span>
              ))}
            </h2>
            <p className="intro-sub">presents</p>
          </div>
          <p className="intro-tap">แตะเพื่อเริ่ม</p>
        </div>
      )}
    </main>
  );
}
