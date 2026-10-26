export function initialPixelRatio(width, height, deviceRatio, mobile) {
  return Math.min(deviceRatio, mobile ? 1 : 1.15, Math.sqrt(1000000 / Math.max(1, width * height)));
}

// Rendering quality changes independently of the input clock and combat rules.
export function createFrameBudget(ceiling) {
  let ratio = ceiling, previous = 0, elapsed = 0, frames = 0, stable = 0;
  const floor = Math.min(ceiling, .55);
  return {
    reset() { previous = elapsed = frames = stable = 0; },
    sample(now) {
      const delta = previous ? now - previous : 0; previous = now;
      if (delta <= 0 || delta > 250) { elapsed = frames = stable = 0; return null; }
      elapsed += delta; frames++;
      if (elapsed < 1000) return null;
      const average = elapsed / frames; elapsed = frames = 0;
      if (average > 20 && ratio > floor) {
        ratio = Math.max(floor, ratio - (average > 30 ? .25 : .1)); stable = 0;
        return ratio;
      }
      stable = average < 17.5 ? stable + 1000 : 0;
      if (stable >= 10000 && ratio < ceiling) {
        ratio = Math.min(ceiling, ratio + .05); stable = 0;
        return ratio;
      }
      return null;
    },
  };
}
