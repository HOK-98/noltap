// Old layouts retain access, but their stars and times cannot score new puzzles.
export function migrateProgress(value){
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const records=data.records&&typeof data.records==='object'?data.records:{};
 const daily=data.daily&&typeof data.daily==='object'?data.daily:{};
 if(data.layoutVersion===2)return {...data,records,daily,unlockedStage:Math.max(1,Math.min(30,Number(data.unlockedStage)||1))};
 const oldIds=Object.keys(records).filter(k=>/^normal-\d+$/.test(k)).map(k=>Number(k.slice(7)));
 return {...data,archivedV1:{records,daily},records:{},daily:{},sound:!!data.sound,layoutVersion:2,unlockedStage:Math.min(30,Math.max(1,...oldIds.map(id=>id+1)))};
}
export function unlockedStage(data){
 let next=1;while(next<30&&data.records['normal-'+next])next++;
 return Math.max(next,data.unlockedStage||1);
}
