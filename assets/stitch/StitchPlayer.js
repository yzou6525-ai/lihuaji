// Original, renderer-independent playback state. One unit of progress is one stitch.
export function validateStitchDemo(data) {
  const fail = () => { throw Error('针迹资料格式不正确，请选择其他练习。'); };
  if (!data || typeof data.id !== 'string' || !/^[a-z0-9-]+$/.test(data.id) || typeof data.title !== 'string' || !data.title.trim()) fail();
  if (!Object.hasOwn(data, 'knowledgeId') || (data.knowledgeId !== null && (typeof data.knowledgeId !== 'string' || !/^[a-z0-9-]+$/.test(data.knowledgeId)))) fail();
  if (data.nature !== 'digital-practice-demo' || data.expertReviewed !== false || data.historicalReconstruction !== false) fail();
  if (!Array.isArray(data.stitches) || !data.stitches.length || data.stitches.length > 10000) fail();
  const ids = new Set(), point = p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && Math.abs(n) <= 10000);
  data.stitches.forEach((s, i) => {
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || s.order !== i + 1 || !Number.isInteger(s.group) || s.group < 1 || !point(s.start) || !point(s.end) || Math.hypot(s.end[0]-s.start[0], s.end[1]-s.start[1]) < .0001) fail();
    if (s.color !== undefined && !/^#[a-f0-9]{6}$/i.test(s.color)) fail();
    ids.add(s.id);
  });
  return data;
}

export class StitchPlayer {
  constructor({onChange = () => {}, requestFrame = cb => requestAnimationFrame(cb), cancelFrame = id => cancelAnimationFrame(id), now = () => performance.now()} = {}) {
    Object.assign(this, {onChange, requestFrame, cancelFrame, now});
    this.data = null; this.position = 0; this.speed = 1; this.playing = false; this.showPoints = false; this.raf = null; this.disposed = false;
  }
  get state() {
    const total = this.data?.stitches.length || 0;
    return {id:this.data?.id || null, position:this.position, total, current:Math.min(total, Math.ceil(this.position)), completed:Math.floor(this.position), playing:this.playing, speed:this.speed, showPoints:this.showPoints, disposed:this.disposed, pendingFrame:this.raf !== null};
  }
  notify() { if (!this.disposed) this.onChange(this.state); }
  loadStitchDemo(data) {
    if (this.disposed) return;
    validateStitchDemo(data); this.pause(); this.data = structuredClone(data); this.position = 0; this.notify();
  }
  play() {
    if (this.disposed || this.playing || !this.data) return;
    if (this.position >= this.data.stitches.length) this.position = 0;
    this.playing = true; this.lastTime = this.now();
    const step = time => {
      this.raf = null;
      if (!this.playing || this.disposed) return;
      // Clamp background-tab stalls instead of jumping over the whole lesson.
      this.position = Math.min(this.data.stitches.length, this.position + Math.max(0, Math.min(100, time-this.lastTime)) / 750 * this.speed);
      this.lastTime = time;
      if (this.position >= this.data.stitches.length) this.playing = false;
      if (this.playing) this.raf = this.requestFrame(step);
      this.notify();
    };
    this.raf = this.requestFrame(step); this.notify();
  }
  pause() { this.playing = false; if (this.raf !== null) this.cancelFrame(this.raf); this.raf = null; this.notify(); }
  seek(position) {
    if (this.disposed || !Number.isFinite(position)) return;
    this.pause(); this.position = Math.max(0, Math.min(this.data?.stitches.length || 0, position)); this.notify();
  }
  next() { this.seek(Math.floor(this.position + .000001) + 1); }
  previous() { this.seek(Math.ceil(this.position - .000001) - 1); }
  setSpeed(speed) { if (![.5, 1, 1.5].includes(speed)) throw Error('不支持的播放速度'); if (!this.disposed) { this.speed = speed; this.notify(); } }
  setPoints(value) { if (!this.disposed) { this.showPoints = !!value; this.notify(); } }
  restart() { this.seek(0); this.play(); }
  dispose() { if (this.disposed) return; this.pause(); this.disposed = true; this.data = null; this.onChange = () => {}; }
}
