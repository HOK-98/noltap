const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };

const guardHand=[-.06,1.35,.32],guardTip=[-.25,2.1,.72];
const windPoses={
  left:[[-.24,1.58,.25],[-1.18,2.04,.58]],
  right:[[.24,1.58,.25],[1.18,2.04,.58]],
  up:[[-.06,1.88,.19],[-.05,3.08,.24]],
  down:[[.1,1.18,.32],[.27,.32,.88]],
};
const arcTips={left:[-.85,1.55,1.9],right:[.85,1.55,1.9],up:[0,2.6,1.65],down:[0,.7,1.85]};
const finishTips={left:[.95,1.02,1.5],right:[-.95,1.02,1.5],up:[0,.5,1.6],down:[0,2.65,1.3]};
const interpolate=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);
const curve=(a,b,c,t)=>a.map((value,i)=>(1-t)*(1-t)*value+2*(1-t)*t*b[i]+t*t*c[i]);

// Each cut approaches the same contact region along its own readable arc.
// The clock still lands at 180ms.
export function swordTrajectory(motion,afterImpact=0) {
  const direction=motion.direction||'right',wind=windPoses[direction];
  const baseHand=motion.feint?[-.06,1.45,.16]:guardHand;
  const baseTip=motion.feint?[-.1,2.4,.15]:guardTip;
  let hand=interpolate(baseHand,wind[0],motion.winding),tip=interpolate(baseTip,wind[1],motion.winding);
  const impactHand=[-.025,1.36,.57],impactTip=[0,1.5,2.45];
  hand=curve(hand,interpolate(wind[0],impactHand,.6),impactHand,motion.swing);
  tip=curve(tip,arcTips[direction],impactTip,motion.swing);
  const follow=smooth(afterImpact);
  if(follow>0){hand=interpolate(hand,[direction==='left'?.13:-.13,1.28,.43],follow);tip=interpolate(tip,finishTips[direction],follow);}
  return {hand,tip};
}

// Feints only come from boss 6+, and settle in the real guard before the strike.
export function attackMotion(attack, age) {
  const feint=Boolean(attack?.fakeDirection&&attack.fakeDirection!==attack.direction);
  if (!attack || attack.answered) return { direction:attack?.direction || 'right', winding:0, swing:0, stage:'idle', feint:false };
  const swingAt = attack.swingAtMs;
  const swing = smooth((age - swingAt) / 180);
  if(!feint)return {
    direction:attack.direction, winding:smooth(age / Math.max(1,swingAt)), swing,
    stage:age >= swingAt ? 'strike' : 'windup', feint:false,
  };
  const reveal=attack.plan.revealAfterMs,withdrawAt=Math.max(0,reveal-100);
  if(age<reveal){
    const prepare=smooth(age/Math.max(120,reveal-100)),withdraw=smooth((age-(reveal-100))/100);
    return {direction:attack.fakeDirection,winding:prepare*(1-withdraw),swing:0,stage:age>=withdrawAt?'withdraw':'fake',feint:true};
  }
  const redirectMs=Math.min(140,Math.max(1,swingAt-reveal-160));
  return {direction:attack.direction,winding:smooth((age-reveal)/redirectMs),swing,
    stage:age>=swingAt?'strike':age<reveal+redirectMs?'redirect':'ready',feint:true};
}
