import {getPlayerIdentity,saveNickname} from '../ranking-api.js';
const disabled=import.meta.env.VITE_DISABLE_RANKING==='true';
async function request(action,payload){
 if(disabled)throw Error('이 미리보기에서는 온라인 랭킹을 사용할 수 없어요.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch(`./api/knight.php?action=${action}`,{method:payload?'POST':'GET',cache:'no-store',signal:controller.signal,...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.message||'랭킹 연결을 확인해주세요.');return body;}finally{clearTimeout(timer);}
}
export function journeyAttempt(stage,mode){
 if(mode!=='normal')return null;
 const events=[],session=request('start',{stage_id:stage.id,mode:'normal'}).then(value=>({value}),error=>({error}));
 return {add(event){events.push(event);},async finish(duration){const s=await session;if(s.error)throw s.error;const result=await request('finish',{...s.value,mode:'normal',duration_ms:Math.round(duration),events:[...events]});if(result.stored!==true)throw Error('기록이 저장되지 않았어요.');return result;}};
}
export function mountJourneyRanking(root){
 const section=document.createElement('section');section.id='journey-ranking';section.className='journey-ranking';section.innerHTML=`<div class="heading"><div><p class="eyebrow">JOURNEY LEADERBOARD</p><h2>여정 랭킹</h2></div><button class="rank-refresh">새로고침</button></div><p>일반 여정만 집계 · 완료 스테이지 수 → 획득 별 → 합산 시간 순</p><form class="rank-profile"><label>랭킹 닉네임 <input name="nickname" required minlength="2" maxlength="16" autocomplete="nickname"></label><button type="submit">저장</button></form><p class="rank-status" role="status"></p><p class="rank-me"></p><div class="rank-scroll"><table><thead><tr><th>순위</th><th>플레이어</th><th>완료</th><th>별</th><th>시간</th></tr></thead><tbody></tbody></table></div><p class="rank-note">TOP 100 · 각 스테이지의 최고 별 기록 중 가장 짧은 시간을 합산해요. 동일 기록은 공동 순위입니다.<br>랭킹 도입 후 서버에서 검증된 완료 기록부터 집계돼요. 기존 기기 기록은 유지되며, 데일리·도전 기록은 제외돼요.</p>`;
 root.querySelector('#home').append(section);const $=s=>section.querySelector(s),input=$('input');input.value=getPlayerIdentity().nickname;
 function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);}
 function duration(ms){const secs=Math.floor(ms/1000);return `${Math.floor(secs/3600)}:${String(Math.floor(secs/60)%60).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;}
 let pending=0;
 async function refresh(){const id=++pending;$('.rank-status').textContent='랭킹을 불러오는 중…';try{const result=await request('leaderboard');if(id!==pending)return;const body=$('tbody');body.replaceChildren();for(const r of result.rows){const tr=document.createElement('tr');if(r.player_id===result.player_id)tr.className='is-me';[r.rank_position,r.nickname,r.completed+' / 60','★ '+r.stars,duration(Number(r.duration_ms))].forEach(value=>cell(tr,value));body.append(tr);}$('.rank-me').textContent=result.me?`내 순위 ${result.me.rank_position}위 · ${result.me.completed}개 완료 · 별 ${result.me.stars}개`:'아직 등록된 여정 기록이 없어요. 일반 여정을 완료해보세요.';$('.rank-status').textContent=result.rows.length?'':'아직 기록이 없어요. 첫 번째 여정을 등록해보세요.';}catch(e){if(id===pending)$('.rank-status').textContent='랭킹에 연결하지 못했어요. 여정은 계속 플레이할 수 있어요.';}}
 section.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=section.querySelector('[type="submit"]');button.disabled=true;try{const nickname=input.value.trim();await request('profile',{nickname});input.value=saveNickname(nickname);await refresh();$('.rank-status').textContent='닉네임을 저장했어요.';}catch(e){$('.rank-status').textContent=e.message;}finally{button.disabled=false;}};
 $('.rank-refresh').onclick=refresh;refresh();return {refresh};
}
