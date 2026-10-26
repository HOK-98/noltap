const noiseBuffers = new WeakMap();
const soundBanks = new WeakMap();
const files={light:'sword-clash-light.wav',heavy:'sword-clash-heavy.wav',swing:'sword-swish-dry.wav',victory:'complete_sound.wav'};

export function prepareCombatAudio(context){
  let bank=soundBanks.get(context);
  if(bank)return bank.loading;
  bank={buffers:{},active:new Set(),sequence:0};soundBanks.set(context,bank);
  bank.loading=Promise.allSettled(Object.entries(files).map(async([key,file])=>{
    const response=await fetch(`${import.meta.env.BASE_URL}audio/${file}`);
    if(!response.ok)throw new Error(`Audio unavailable: ${file}`);
    bank.buffers[key]=await context.decodeAudioData(await response.arrayBuffer());
  })).then(()=>{
    document.documentElement.dataset.parryAudio=['light','heavy','swing'].every(key=>bank.buffers[key])?'ready':'fallback';
    return bank;
  });
  return bank.loading;
}

function playSample(context,key,{volume=.4,rate=1,cutoff=18000}={}){
  const bank=soundBanks.get(context),buffer=bank?.buffers[key];
  if(!buffer)return false;
  const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
  source.buffer=buffer;source.playbackRate.value=rate;
  filter.type='lowpass';filter.frequency.value=cutoff;
  const now=context.currentTime,end=now+buffer.duration/rate;
  gain.gain.setValueAtTime(volume,now);gain.gain.setValueAtTime(volume,Math.max(now,end-.035));gain.gain.linearRampToValueAtTime(0,end);
  source.connect(filter);filter.connect(gain);gain.connect(context.destination);
  bank.active.add(source);
  source.onended=()=>{bank.active.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
  source.start(now);return true;
}

export function stopCombatAudio(context){
  for(const source of soundBanks.get(context)?.active||[])try{source.stop();}catch{/* Already ended. */}
}

export function playSwordSwing(context){
  playSample(context,'swing',{volume:.09,rate:1.15,cutoff:7000});
}

export function playCompletionChime(context){
  playSample(context,'victory',{volume:.3,rate:1,cutoff:12000});
}

export function playMetalClash(context,rating){
  const bank=soundBanks.get(context),variation=bank?((bank.sequence++%5)-2)*.018:0;
  const key=rating==='good'?'light':'heavy';
  const options=rating==='miss'?{volume:.42,rate:.78+variation,cutoff:1900}
    :rating==='perfect'?{volume:.52,rate:1.08+variation,cutoff:18000}
    :{volume:.4,rate:.98+variation,cutoff:13000};
  if(!playSample(context,key,options))playSynthClash(context,rating);
}

// Short filtered impact plus inharmonic ringing, generated once per AudioContext.
function playSynthClash(context,rating) {
  const now=context.currentTime, miss=rating==='miss', perfect=rating==='perfect';
  let buffer=noiseBuffers.get(context);
  if(!buffer){buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.18),context.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;noiseBuffers.set(context,buffer);}
  const noise=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  noise.buffer=buffer;filter.type='highpass';filter.frequency.value=miss?140:1700;
  gain.gain.setValueAtTime(miss?.11:.07,now);gain.gain.exponentialRampToValueAtTime(.001,now+.13);
  noise.connect(filter);filter.connect(gain);gain.connect(context.destination);noise.start(now);noise.stop(now+.16);
  noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
  const frequencies=miss?[82,134]:perfect?[1470,2381,3670]:[1120,1897,2930];
  frequencies.forEach((frequency,i)=>{
    const oscillator=context.createOscillator(),ring=context.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(frequency*.92,now+.25);
    ring.gain.setValueAtTime((miss?.065:.035)/(i+1),now);ring.gain.exponentialRampToValueAtTime(.0001,now+(perfect?.42:.26));
    oscillator.connect(ring);ring.connect(context.destination);oscillator.start(now);oscillator.stop(now+.46);oscillator.onended=()=>{oscillator.disconnect();ring.disconnect();};
  });
}
