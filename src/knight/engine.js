export const jumps=[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
export function neighbors(id,size){const x=id%size,y=Math.floor(id/size);return jumps.map(([dx,dy])=>[x+dx,y+dy]).filter(([a,b])=>a>=0&&a<size&&b>=0&&b<size).map(([a,b])=>b*size+a);}
export function moves(stage,path){const used=new Set([...stage.blocked,...path]);return neighbors(path.at(-1),stage.size).filter(id=>!used.has(id)&&(id!==stage.goal||path.length===stage.size**2-stage.blocked.length-1));}
export function status(stage,path){if(path.length===stage.size**2-stage.blocked.length)return stage.goal==null||path.at(-1)===stage.goal?'clear':'failed';return moves(stage,path).length?'playing':'failed';}
export function stars(hints,undos){return !hints&&!undos?3:hints<=1&&undos<=2?2:1;}
export function validate(stage){const p=stage.solution;return p.length===stage.size**2-stage.blocked.length&&p[0]===stage.start&&new Set(p).size===p.length&&p.every((id,i)=>Number.isInteger(id)&&id>=0&&id<stage.size**2&&!stage.blocked.includes(id)&&(!i||neighbors(p[i-1],stage.size).includes(id)))&&(stage.goal==null||p.at(-1)===stage.goal);}
export function solve(stage,path,{budgetMs=1800,maxNodes=350000}={}){
 const start=performance.now(),target=stage.size**2-stage.blocked.length,used=new Set([...stage.blocked,...path]);let nodes=0,timeout=false;
 if(stage.solution&&path.every((id,i)=>stage.solution[i]===id))return{state:'solved',path:stage.solution.slice(path.length)};
 const route=[];
 function dfs(id){if(++nodes>maxNodes||performance.now()-start>budgetMs){timeout=true;return false;}if(path.length+route.length===target)return stage.goal==null||id===stage.goal;
 const choices=neighbors(id,stage.size).filter(n=>!used.has(n)&&(n!==stage.goal||path.length+route.length===target-1));choices.sort((a,b)=>neighbors(a,stage.size).filter(n=>!used.has(n)).length-neighbors(b,stage.size).filter(n=>!used.has(n)).length);
 for(const n of choices){used.add(n);route.push(n);if(dfs(n))return true;route.pop();used.delete(n);if(timeout)return false;}return false;}
 const ok=dfs(path.at(-1));return{state:ok?'solved':timeout?'timeout':'impossible',path:ok?[...route]:[]};
}
export function kstDay(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function dailyStage(stages,day){let hash=2166136261;for(const ch of day){hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;}const base=stages[10+hash%14],n=base.size;const flip=hash&1,turn=(hash>>>2)%4;const map=id=>{let x=id%n,y=Math.floor(id/n);if(flip)x=n-1-x;for(let i=0;i<turn;i++)[x,y]=[n-1-y,x];return y*n+x;};return{...base,id:'daily-'+day,name:'오늘의 여정',blocked:base.blocked.map(map),solution:base.solution.map(map),start:map(base.start),goal:base.goal==null?null:map(base.goal)};}
