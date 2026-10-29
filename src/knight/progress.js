// Old layouts retain access, but their stars and times cannot score new puzzles.
export function migrateProgress(value,total=60){
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const records=data.records&&typeof data.records==='object'?data.records:{};
 const daily=data.daily&&typeof data.daily==='object'?data.daily:{};
 if(data.layoutVersion===2)return {...data,records,daily,unlockedStage:Math.max(1,Math.min(total,Number(data.unlockedStage)||1))};
 const oldIds=Object.keys(records).filter(k=>/^normal-\d+$/.test(k)).map(k=>Number(k.slice(7)));
 return {...data,archivedV1:{records,daily},records:{},daily:{},sound:!!data.sound,layoutVersion:2,unlockedStage:Math.min(total,Math.max(1,...oldIds.map(id=>id+1)))};
}
export function unlockedStage(data,total=60){
 let next=1;while(next<total&&data.records['normal-'+next])next++;
 for(const key of Object.keys(data.records)){if(/^normal-\d+$/.test(key))next=Math.max(next,Math.min(total,Number(key.slice(7))+1));}
 return Math.min(total,Math.max(next,data.unlockedStage||1));
}
