const SOURCES = {
  hit: 'assets/sounds/hit.mp3',
  miss: 'assets/sounds/miss.mp3',
  sunk: 'assets/sounds/sunk.mp3',
  victory: 'assets/sounds/victory.mp3',
};

const VOLUMES = {
  hit: 0.7,
  miss: 0.6,
  sunk: 0.8,
  victory: 0.6,
};

const POOL_SIZE = 3;

class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('battleship:muted') === 'true';
    this.pools = new Map();
    Object.entries(SOURCES).forEach(([name, src]) => {
      const pool = [];
      for (let i = 0; i < POOL_SIZE; i += 1) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = VOLUMES[name] ?? 0.7;
        pool.push(audio);
      }
      this.pools.set(name, { clips: pool, index: 0 });
    });
  }

  get isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('battleship:muted', String(this.muted));
    if (this.muted) this.stopAll();
    return this.muted;
  }

  play(name) {
    if (this.muted) return;
    const pool = this.pools.get(name);
    if (!pool) return;
    const clip = pool.clips[pool.index];
    pool.index = (pool.index + 1) % pool.clips.length;
    clip.currentTime = 0;
    const attempt = clip.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        /* autoplay blocked until first user gesture */
      });
    }
  }

  stopAll() {
    this.pools.forEach(({ clips }) => {
      clips.forEach((clip) => {
        clip.pause();
        clip.currentTime = 0;
      });
    });
  }
}

export const audio = new AudioManager();
