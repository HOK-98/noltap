<?php
declare(strict_types=1);
define('PLAYBOX_API_BOOTSTRAPPED',true);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
require_once __DIR__.'/lib.php';require_once __DIR__.'/knight-rules.php';
function knight_ranked(): string {return "SELECT a.*,p.nickname,RANK() OVER (ORDER BY completed DESC,stars DESC,duration_ms ASC) AS rank_position FROM (SELECT player_id,COUNT(*) completed,SUM(stars) stars,SUM(duration_ms) duration_ms,MAX(stage_id) highest_stage FROM knight_stage_records WHERE rules_version=2 GROUP BY player_id) a JOIN players p ON p.id=a.player_id";}
try {
 $private=dirname(__DIR__,2).'/noltap-private-config.php';$file=is_file($private)?$private:__DIR__.'/config.php';
 if(!is_file($file))api_fail(503,'setup_required','랭킹 서버 설정이 필요합니다.');
 $config=require $file;$pdo=database($config);
 try{$pdo->query('SELECT stage_id FROM knight_stage_records LIMIT 0');$pdo->query('SELECT id FROM knight_runs LIMIT 0');}catch(PDOException $e){if($e->getCode()!=='42S02')throw $e;$pdo->exec(file_get_contents(__DIR__.'/knight-schema.sql'));}
 $action=(string)($_GET['action']??'leaderboard');
 if($action==='leaderboard'){
  require_method('GET');rate_limit($pdo,$config,'knight_read',90,60);
  $rows=$pdo->query('SELECT * FROM ('.knight_ranked().') ranked ORDER BY rank_position,player_id LIMIT 100')->fetchAll();
  $key=hash('sha256',request_player_key());$q=$pdo->prepare('SELECT id FROM players WHERE player_key_hash=?');$q->execute([$key]);$pid=$q->fetchColumn();$me=null;
  if($pid){$q=$pdo->prepare('SELECT * FROM ('.knight_ranked().') ranked WHERE player_id=?');$q->execute([$pid]);$me=$q->fetch()?:null;}
  api_ok(['rows'=>$rows,'me'=>$me,'player_id'=>$pid?:null]);
 }
 require_method('POST');rate_limit($pdo,$config,'knight_write',90,60);$input=read_json_body();
 if($action==='profile'){$player=ensure_player($pdo,$input,true);api_ok($player);}
 if(($input['mode']??'normal')!=='normal')api_fail(422,'unranked_mode','일반 여정만 랭킹에 등록됩니다.');
 $player=ensure_player($pdo,$input,false);
 if($action==='start'){
  $id=$input['stage_id']??null;$stages=json_decode(file_get_contents(__DIR__.'/knight-stages.json'),true,512,JSON_THROW_ON_ERROR);
  if(!is_int($id)||$id<1||$id>count($stages))api_fail(422,'invalid_stage','스테이지가 올바르지 않습니다.');
  $run=uuid_v4();$token=bin2hex(random_bytes(32));$q=$pdo->prepare('INSERT INTO knight_runs(id,player_id,token_hash,stage_id,started_ms) VALUES(?,?,?,?,?)');$q->execute([$run,$player['id'],hash('sha256',$token),$id,(int)round(microtime(true)*1000)]);
  api_ok(['run_id'=>$run,'token'=>$token]);
 }
 if($action==='finish'){
  $pdo->beginTransaction();$q=$pdo->prepare('SELECT * FROM knight_runs WHERE id=? AND player_id=? FOR UPDATE');$q->execute([(string)($input['run_id']??''),$player['id']]);$run=$q->fetch();
  if(!$run||!hash_equals($run['token_hash'],hash('sha256',(string)($input['token']??''))))throw new ApiException(403,'invalid_session','게임 세션을 확인할 수 없습니다.');
  if((int)$run['finished'])throw new ApiException(409,'already_finished','이미 등록한 여정입니다.');
  $wall=(int)round(microtime(true)*1000)-(int)$run['started_ms'];$duration=$input['duration_ms']??null;
  if(!is_int($duration)||$duration>$wall+3000||$wall>86400000)throw new ApiException(422,'invalid_time','게임 세션 시간이 올바르지 않습니다.');
  $lock=$pdo->prepare('SELECT id FROM players WHERE id=? FOR UPDATE');$lock->execute([$player['id']]);
  $stages=json_decode(file_get_contents(__DIR__.'/knight-stages.json'),true,512,JSON_THROW_ON_ERROR);$stage=$stages[(int)$run['stage_id']-1];
  if(!isset($input['events'])||!is_array($input['events']))throw new ApiException(422,'invalid_events','입력 경로가 필요합니다.');$r=knight_verify($stage,$input['events'],$duration);
  $q=$pdo->prepare('SELECT * FROM knight_stage_records WHERE player_id=? AND rules_version=2 AND stage_id=? FOR UPDATE');$q->execute([$player['id'],$stage['id']]);$old=$q->fetch();
  if(!$old||$r['stars']>(int)$old['stars']||($r['stars']==(int)$old['stars']&&$duration<(int)$old['duration_ms'])){
   $q=$pdo->prepare('INSERT INTO knight_stage_records(player_id,stage_id,stars,duration_ms,hints,undos,updated_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE stars=VALUES(stars),duration_ms=VALUES(duration_ms),hints=VALUES(hints),undos=VALUES(undos),updated_at=UTC_TIMESTAMP()');$q->execute([$player['id'],$stage['id'],$r['stars'],$duration,$r['hints'],$r['undos']]);
  }
  $q=$pdo->prepare('UPDATE knight_runs SET finished=1 WHERE id=?');$q->execute([$run['id']]);if(($input['dry_run']??false)===true){$pdo->rollBack();api_ok(['record'=>$r,'stored'=>false]);}$pdo->commit();api_ok(['record'=>$r,'stored'=>true]);
 }
 api_fail(404,'unknown_action','요청을 찾을 수 없습니다.');
}catch(ApiException $e){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();api_fail($e->status,$e->errorCode,$e->getMessage());}catch(Throwable $e){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();error_log('Knight API: '.$e->getMessage());api_fail(503,'server_error','랭킹 서버 연결을 확인해주세요.');}
