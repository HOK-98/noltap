const samples = { win: 'complete_sound.wav', insert: 'knife-wood-insert.wav' };

export class PirateSound {
  constructor(enabled = true) { this.enabled = enabled; this.context = null; this.sources = new Set(); this.buffers = {}; this.samplesLoading = null; }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume();
      this.loadSamples();
    } catch { /* Sound is optional. */ }
  }
  loadSamples() {
    if (!this.context || this.samplesLoading) return this.samplesLoading;
    const context = this.context;
    this.samplesLoading = Promise.all(Object.entries(samples).map(async ([name, file]) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/${file}`);
        if (!response.ok) return;
        this.buffers[name] = await context.decodeAudioData(await response.arrayBuffer());
      } catch { /* Audio is optional. */ }
    }));
    return this.samplesLoading;
  }
  stop() { for (const source of this.sources) { try { source.stop(); } catch {} } this.sources.clear(); }
  playSample(name, volume) {
    const context = this.context;
    const start = buffer => {
      if (!buffer || !this.enabled || this.context !== context || context.state !== 'running') return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; gain.gain.value = volume; source.connect(gain); gain.connect(context.destination);
      this.sources.add(source);
      source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
      source.start();
    };
    if (this.buffers[name]) start(this.buffers[name]);
    else this.loadSamples()?.then(() => start(this.buffers[name]));
  }
  play(kind) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context, now = ctx.currentTime;
    if (kind === 'win' || kind === 'insert') {
      this.playSample(kind, kind === 'insert' ? .4 : .34);
      return;
    }
    const notes = kind === 'lose' ? [392, 330, 262] : kind === 'pop' ? [180, 540, 850] : [740];
    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = now + index * .075;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(freq, at);
      oscillator.frequency.exponentialRampToValueAtTime(freq * (kind === 'pop' ? 1.5 : .8), at + .14);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.065, at + .006); gain.gain.exponentialRampToValueAtTime(.001, at + .2);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(at); oscillator.stop(at + .22);
      this.sources.add(oscillator); oscillator.onended = () => { this.sources.delete(oscillator); gain.disconnect(); oscillator.disconnect(); };
    });
    if (kind === 'pop') {
      const length = Math.floor(ctx.sampleRate * .12), buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
      const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      source.buffer = buffer; filter.frequency.value = kind === 'pop' ? 2400 : 850; gain.gain.value = .18;
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start(); this.sources.add(source);
      source.onended = () => { this.sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  }
}
