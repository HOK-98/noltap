<?php
define('PLAYBOX_API_BOOTSTRAPPED',true);require __DIR__.'/../public/api/lib.php';require __DIR__.'/../public/api/knight-rules.php';
function check($yes){if(!$yes)throw new Exception('check failed');}
function rejected($stage,$events,$time){try{knight_verify($stage,$events,$time);throw new Exception('accepted bad run');}catch(ApiException $e){check($e->status===422);}}
$stages=json_decode(file_get_contents(__DIR__.'/../public/api/knight-stages.json'),true);
foreach($stages as $s){$events=array_map(fn($id)=>['type'=>'move','cell'=>$id],array_slice($s['solution'],1));$ms=count($events)*200;$r=knight_verify($s,$events,$ms);check($r['stars']===3);$hinted=array_merge([['type'=>'hint']],$events);check(knight_verify($s,$hinted,$ms)['stars']===2);$undone=array_merge([$events[0],['type'=>'undo']],$events);$r=knight_verify($s,$undone,$ms+400);check($r['stars']===2&&$r['undos']===1);rejected($s,array_slice($events,0,-1),$ms);rejected($s,array_merge($events,[['type'=>'hint']]),$ms);rejected($s,[['type'=>'move','cell'=>$s['start']]],$ms);rejected($s,$events,0);}
echo 'PASS 60 PHP paths, recomputed stars/hints/undo; rejects incomplete, duplicate visit, events after clear, impossible duration'.PHP_EOL;
