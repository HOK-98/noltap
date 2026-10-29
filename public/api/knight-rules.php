<?php
declare(strict_types=1);
if (!defined('PLAYBOX_API_BOOTSTRAPPED')) { http_response_code(404); exit; }
function knight_verify(array $stage,array $events,int $duration): array {
 if (!$events || count($events)>5000) throw new ApiException(422,'invalid_events','여정 입력 기록이 올바르지 않습니다.');
 $path=[$stage['start']];$hints=0;$undos=0;$steps=0;$target=$stage['size']**2-count($stage['blocked']);
 foreach($events as $event){
  if(!is_array($event))throw new ApiException(422,'invalid_event','입력 형식이 올바르지 않습니다.');
  if(count($path)===$target) throw new ApiException(422,'after_clear','완료 이후 입력이 있습니다.');
  $type=$event['type']??'';
  if($type==='move'){
   $id=$event['cell']??null;$from=end($path);$n=$stage['size'];
   if(!is_int($id)||$id<0||$id>=$n*$n||in_array($id,$stage['blocked'],true)||in_array($id,$path,true)||abs($id%$n-$from%$n)*abs(intdiv($id,$n)-intdiv($from,$n))!==2||($id===$stage['goal']&&count($path)!==$target-1))throw new ApiException(422,'illegal_move','이동 경로가 규칙과 맞지 않습니다.');
   $path[]=$id;$steps++;
  } elseif($type==='undo'){
   if(count($path)<=1)throw new ApiException(422,'illegal_undo','되돌리기 기록이 올바르지 않습니다.');array_pop($path);$undos++;
  } elseif($type==='hint'){
   if(++$hints>$stage['hintLimit'])throw new ApiException(422,'too_many_hints','힌트 사용 횟수가 올바르지 않습니다.');
  } else throw new ApiException(422,'invalid_event','알 수 없는 여정 입력입니다.');
 }
 if(count($path)!==$target||($stage['goal']!==null&&end($path)!==$stage['goal']))throw new ApiException(422,'incomplete','완료한 여정만 등록할 수 있습니다.');
 if($duration<max(0,($steps-1)*180)||$duration>86400000)throw new ApiException(422,'invalid_duration','여행 시간이 올바르지 않습니다.');
 return ['stars'=>!$hints&&!$undos?3:($hints<=1&&$undos<=2?2:1),'hints'=>$hints,'undos'=>$undos,'duration_ms'=>$duration];
}
