<?php
declare(strict_types=1);

define('PLAYBOX_API_BOOTSTRAPPED', true);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
require_once __DIR__ . '/lib.php';

function parry_u32(int $value): int { return $value & 0xffffffff; }

function parry_imul(int $left, int $right): int
{
    $left = parry_u32($left); $right = parry_u32($right);
    $low = ($left & 0xffff) * ($right & 0xffff);
    $cross = (($left >> 16) * ($right & 0xffff)) + (($left & 0xffff) * ($right >> 16));
    return parry_u32($low + ($cross << 16));
}

function parry_random(int &$state): float
{
    $state = parry_u32($state ^ (($state << 13) & 0xffffffff));
    $state = parry_u32($state ^ ($state >> 17));
    $state = parry_u32($state ^ (($state << 5) & 0xffffffff));
    return $state / 4294967296;
}

function parry_plan(int $seed, int $boss, int $planIndex): array
{
    $state = parry_u32($seed ^ parry_imul($boss, 0x9e3779b1) ^ parry_imul($planIndex + 1, 0x85ebca77));
    if ($state === 0) $state = 0x6d2b79f5;
    $types = $boss <= 2 ? ['slash'] : ($boss <= 4 ? ['slash','delay'] : ($boss === 5 ? ['slash','delay','fast'] : ['slash','delay','feint','fast']));
    $type = $types[(int)floor(parry_random($state) * count($types))];
    $hitCount = 1;
    if ($boss === 2) $hitCount = parry_random($state) < 0.55 ? 2 : 1;
    elseif ($boss === 3 || $boss === 4) $hitCount = parry_random($state) < 0.65 ? 2 : 1;
    elseif ($boss === 5) $hitCount = parry_random($state) < 0.45 ? 3 : 2;
    elseif ($boss === 6) $hitCount = parry_random($state) < 0.25 ? 4 : (parry_random($state) < 0.55 ? 3 : 2);
    elseif ($boss >= 7) {
        $roll = parry_random($state);
        $hitCount = $roll < 0.18 ? 1 : ($roll < 0.55 ? 2 : ($roll < 0.85 ? 3 : 4));
    }
    $directions = ['left', 'right', 'up', 'down']; $hits = [];
    for ($index = 0; $index < $hitCount; $index++) {
        $direction = $directions[(int)floor(parry_random($state) * 4)];
        $fakeDirection = null;
        if ($type === 'feint' && $index === 0) $fakeDirection = $directions[(array_search($direction,$directions,true)+1+(int)floor(parry_random($state)*3))%4];
        $hits[] = ['direction' => $direction, 'fake_direction' => $fakeDirection];
    }
    $baseWarning = max(520, 900 - ($boss - 1) * 45);
    $warning = max($type === 'feint' ? 850 : 520, $baseWarning + ($type === 'delay' ? 420 : 0) - ($type === 'fast' ? 210 : 0));
    foreach ($hits as $index => &$hit) $hit['warning_ms'] = $index === 0 ? $warning : max(360,min(440,$warning-240));
    unset($hit);
    return [
        'type' => $type,
        'hits' => $hits,
        'warning_ms' => $warning,
        'reveal_after_ms' => $type === 'feint' ? $warning-500 : 0,
        'interval_ms' => max(125,205-max(0,$boss-2)*12),
    ];
}

function parry_boss_hp(int $boss): int { return min(250, 100 + (max(1, $boss) - 1) * 20); }
function parry_boss_damage(int $boss): int
{
    $fixed = [1 => 10, 2 => 14, 3 => 18, 4 => 22, 5 => 28, 6 => 35];
    return $fixed[$boss] ?? min(60, 35 + ($boss - 6) * 4);
}

function parry_classify(?string $direction, string $target, int $offset): string
{
    if (!in_array($direction, ['left', 'right', 'up', 'down'], true) || $direction !== $target || abs($offset) > 150) return 'miss';
    return abs($offset) <= 70 ? 'perfect' : 'good';
}

function parry_verify_run(int $seed, array $events): array
{
    if (count($events) < 1 || count($events) > 3000) api_fail(422, 'invalid_events', '전투 기록 개수가 올바르지 않습니다.');
    $boss = 1; $planIndex = 0; $hitIndex = 0; $plan = parry_plan($seed, $boss, $planIndex);
    $bossHp = parry_boss_hp($boss); $playerHp = 100; $score = 0; $combo = 0; $bestCombo = 0;
    $perfectStreak = 0; $bossesDefeated = 0; $lastBossParries = 0; $perfects = 0; $goods = 0; $misses = 0;
    $previousElapsed = null; $expectedImpact = 3000 + $plan['warning_ms']; $totalSuccess = 0;

    foreach ($events as $eventIndex => $event) {
        if (!is_array($event) || (int)($event['boss'] ?? 0) !== $boss || (int)($event['plan_index'] ?? -1) !== $planIndex || (int)($event['hit_index'] ?? -1) !== $hitIndex) {
            api_fail(422, 'invalid_event_order', '보스 공격 순서가 서버 패턴과 일치하지 않습니다.');
        }
        $direction = isset($event['direction']) && is_string($event['direction']) ? $event['direction'] : null;
        $offset = isset($event['offset_ms']) && is_numeric($event['offset_ms']) ? (int)$event['offset_ms'] : null;
        $elapsed = isset($event['elapsed_ms']) && is_numeric($event['elapsed_ms']) ? (int)$event['elapsed_ms'] : null;
        $rating = (string)($event['rating'] ?? '');
        if ($offset === null || $elapsed === null || $elapsed < 0 || $elapsed > 36000000 || ($previousElapsed !== null && $elapsed < $previousElapsed)) {
            api_fail(422, 'invalid_event_time', '전투 입력 시간 순서가 올바르지 않습니다.');
        }
        $target = $plan['hits'][$hitIndex]['direction'];
        $isTimeout = $direction === null;
        if ($isTimeout) {
            if ($rating !== 'miss' || $offset < 151 || $offset > 1500) api_fail(422, 'invalid_timeout', '공격 제한시간을 넘긴 기록이 올바르지 않습니다.');
        } else {
            if (!in_array($direction, ['left', 'right', 'up', 'down'], true) || abs($offset) > 2000) api_fail(422, 'invalid_direction', '패링 방향 또는 입력 시각이 올바르지 않습니다.');
            if (parry_classify($direction, $target, $offset) !== $rating) api_fail(422, 'rating_mismatch', '패링 판정이 서버 공격 패턴과 일치하지 않습니다.');
        }
        if ($rating !== 'miss' && !in_array($rating, ['perfect', 'good'], true)) api_fail(422, 'invalid_rating', '패링 결과가 올바르지 않습니다.');
        if (abs($elapsed - ($expectedImpact + $offset)) > 650) api_fail(422, 'impossible_attack_time', '패링 입력 시점이 공격 애니메이션과 일치하지 않습니다.');

        if ($rating === 'miss') {
            $misses++; $combo = 0; $perfectStreak = 0; $playerHp = max(0, $playerHp - parry_boss_damage($boss));
        } else {
            $totalSuccess++; $combo++; $bestCombo = max($bestCombo, $combo); $lastBossParries++;
            $perfectStreak = $rating === 'perfect' ? $perfectStreak + 1 : 0;
            $comboBonus = min(50, max(0, ($combo - 1) * 5));
            $perfectBonus = $rating === 'perfect' ? min(50, max(0, ($perfectStreak - 1) * 10)) : 0;
            $score += ($rating === 'perfect' ? 150 : 100) + $comboBonus + $perfectBonus;
            if ($rating === 'perfect') { $perfects++; $bossHp = max(0, $bossHp - 25); }
            else { $goods++; $bossHp = max(0, $bossHp - 10); }
            if ($bossHp === 0) {
                $score += 500; $bossesDefeated++; $boss++; $bossHp = parry_boss_hp($boss); $playerHp = min(100, $playerHp + 15);
                $lastBossParries = 0; $planIndex = 0; $hitIndex = 0; $plan = parry_plan($seed, $boss, $planIndex);
                $expectedImpact = $elapsed + 1500 + 520 + $plan['warning_ms'];
            } else {
                if ($hitIndex + 1 < count($plan['hits'])) {
                    $hitIndex++;
                    $expectedImpact = $elapsed + $plan['interval_ms'] + $plan['hits'][$hitIndex]['warning_ms'];
                } else {
                    $planIndex++; $hitIndex = 0; $plan = parry_plan($seed, $boss, $planIndex);
                    $expectedImpact = $elapsed + 620 + $plan['warning_ms'];
                }
            }
        }
        if ($rating === 'miss') {
            if ($playerHp === 0 && $eventIndex !== count($events) - 1) api_fail(422, 'events_after_game_over', '전투 종료 후 추가 공격 기록이 있습니다.');
            if ($hitIndex + 1 < count($plan['hits'])) {
                $hitIndex++;
                $expectedImpact = $elapsed + $plan['interval_ms'] + $plan['hits'][$hitIndex]['warning_ms'];
            } else {
                $planIndex++; $hitIndex = 0; $plan = parry_plan($seed, $boss, $planIndex);
                $expectedImpact = $elapsed + 620 + $plan['warning_ms'];
            }
        }
        if ($playerHp === 0 && $eventIndex !== count($events) - 1) api_fail(422, 'events_after_game_over', '전투 종료 후 추가 공격 기록이 있습니다.');
        $previousElapsed = $elapsed;
    }
    if ($playerHp > 0) api_fail(422, 'run_incomplete', '플레이어 HP가 0이 된 전투만 기록할 수 있습니다.');
    return [
        'bosses_defeated' => $bossesDefeated,
        'last_boss_parries' => $lastBossParries,
        'score' => $score,
        'perfect_rate' => $totalSuccess ? round($perfects / $totalSuccess * 100, 2) : 0,
        'best_combo' => $bestCombo,
        'perfects' => $perfects,
        'goods' => $goods,
        'misses' => $misses,
        'total_attacks' => count($events),
    ];
}

function parry_daily_seed(PDO $pdo, array $config, string $date): int
{
    $query = $pdo->prepare('SELECT seed FROM parry_daily_challenges WHERE challenge_date = :date AND rules_version = 2 LIMIT 1');
    $query->execute([':date' => $date]); $seed = $query->fetchColumn();
    if ($seed !== false) return (int)$seed;
    $seed = (int)hexdec(substr(hash_hmac('sha256', 'playbox-parry-daily-v2:' . $date, (string)$config['app_secret']), 0, 8));
    if ($seed === 0) $seed = 0x6d2b79f5;
    $insert = $pdo->prepare('INSERT INTO parry_daily_challenges (challenge_date, seed, rules_version, created_at) VALUES (:date, :seed, 2, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE seed = VALUES(seed), rules_version = VALUES(rules_version)');
    $insert->execute([':date' => $date, ':seed' => $seed]);
    $query->execute([':date' => $date]); return (int)$query->fetchColumn();
}

function parry_leaderboard(PDO $pdo, string $mode, ?string $date, int $limit, ?string $playerId): array
{
    $scope = $mode === 'daily' ? 'r.challenge_date = :date' : 'r.challenge_date IS NULL';
    $better = '(b.bosses_defeated > r.bosses_defeated OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries > r.last_boss_parries) OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries = r.last_boss_parries AND b.score > r.score) OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries = r.last_boss_parries AND b.score = r.score AND b.perfect_rate > r.perfect_rate) OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries = r.last_boss_parries AND b.score = r.score AND b.perfect_rate = r.perfect_rate AND (b.submitted_at < r.submitted_at OR (b.submitted_at = r.submitted_at AND b.id < r.id))))';
    $sql = 'SELECT r.id, r.player_id, p.nickname, r.bosses_defeated, r.last_boss_parries, r.score, r.perfect_rate FROM parry_runs r JOIN players p ON p.id = r.player_id WHERE r.mode = :mode AND r.rules_version = 2 AND r.status = \'verified\' AND ' . $scope . ' AND NOT EXISTS (SELECT 1 FROM parry_runs b WHERE b.player_id = r.player_id AND b.mode = r.mode AND b.challenge_date <=> r.challenge_date AND b.rules_version = 2 AND b.status = \'verified\' AND ' . str_replace('b.', 'b.', $better) . ') ORDER BY r.bosses_defeated DESC, r.last_boss_parries DESC, r.score DESC, r.perfect_rate DESC, r.submitted_at ASC, r.id ASC LIMIT :limit';
    $statement = $pdo->prepare($sql); $statement->bindValue(':mode', $mode, PDO::PARAM_STR);
    if ($mode === 'daily') $statement->bindValue(':date', $date, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT); $statement->execute(); $rows = $statement->fetchAll();
    foreach ($rows as $index => &$row) {
        $row = ['rank' => $index + 1, 'nickname' => $row['nickname'], 'bosses_defeated' => (int)$row['bosses_defeated'], 'last_boss_parries' => (int)$row['last_boss_parries'], 'score' => (int)$row['score'], 'perfect_rate' => (float)$row['perfect_rate'], 'is_me' => $playerId !== null && hash_equals((string)$row['player_id'], $playerId)];
    }
    unset($row);
    $rank = null;
    if ($playerId !== null) {
        $dateClause = $mode === 'daily' ? 'challenge_date = :date' : 'challenge_date IS NULL';
        $best = $pdo->prepare('SELECT bosses_defeated, last_boss_parries, score, perfect_rate, submitted_at, id FROM parry_runs WHERE player_id = :player_id AND mode = :mode AND rules_version = 2 AND status = \'verified\' AND ' . $dateClause . ' ORDER BY bosses_defeated DESC, last_boss_parries DESC, score DESC, perfect_rate DESC, submitted_at ASC, id ASC LIMIT 1');
        $best->bindValue(':player_id', $playerId, PDO::PARAM_STR); $best->bindValue(':mode', $mode, PDO::PARAM_STR); if ($mode === 'daily') $best->bindValue(':date', $date, PDO::PARAM_STR); $best->execute(); $target = $best->fetch();
        if ($target) {
            $targetOrder = '(r.bosses_defeated > :tb1 OR (r.bosses_defeated = :tb2 AND r.last_boss_parries > :tp1) OR (r.bosses_defeated = :tb3 AND r.last_boss_parries = :tp2 AND r.score > :ts1) OR (r.bosses_defeated = :tb4 AND r.last_boss_parries = :tp3 AND r.score = :ts2 AND r.perfect_rate > :tr1) OR (r.bosses_defeated = :tb5 AND r.last_boss_parries = :tp4 AND r.score = :ts3 AND r.perfect_rate = :tr2 AND (r.submitted_at < :tdate1 OR (r.submitted_at = :tdate2 AND r.id < :tid)))';
            $count = $pdo->prepare('SELECT COUNT(*) FROM parry_runs r WHERE r.mode = :mode AND r.rules_version = 2 AND r.status = \'verified\' AND ' . ($mode === 'daily' ? 'r.challenge_date = :date' : 'r.challenge_date IS NULL') . ' AND NOT EXISTS (SELECT 1 FROM parry_runs b WHERE b.player_id = r.player_id AND b.mode = r.mode AND b.challenge_date <=> r.challenge_date AND b.rules_version = 2 AND b.status = \'verified\' AND (b.bosses_defeated > r.bosses_defeated OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries > r.last_boss_parries) OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries = r.last_boss_parries AND b.score > r.score) OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries = r.last_boss_parries AND b.score = r.score AND b.perfect_rate > r.perfect_rate) OR (b.bosses_defeated = r.bosses_defeated AND b.last_boss_parries = r.last_boss_parries AND b.score = r.score AND b.perfect_rate = r.perfect_rate AND (b.submitted_at < r.submitted_at OR (b.submitted_at = r.submitted_at AND b.id < r.id))))) AND ' . $targetOrder . ')');
            $count->bindValue(':mode', $mode, PDO::PARAM_STR); if ($mode === 'daily') $count->bindValue(':date', $date, PDO::PARAM_STR);
            foreach ([':tb1' => ':tb2', ':tb3' => ':tb4', ':tb5' => null] as $placeholder => $_) $count->bindValue($placeholder, (int)$target['bosses_defeated'], PDO::PARAM_INT);
            foreach ([':tp1' => ':tp2', ':tp3' => ':tp4'] as $placeholder => $_) $count->bindValue($placeholder, (int)$target['last_boss_parries'], PDO::PARAM_INT);
            foreach ([':ts1' => ':ts2', ':ts3' => null] as $placeholder => $_) $count->bindValue($placeholder, (int)$target['score'], PDO::PARAM_INT);
            $count->bindValue(':tr1', (string)$target['perfect_rate'], PDO::PARAM_STR); $count->bindValue(':tr2', (string)$target['perfect_rate'], PDO::PARAM_STR); $count->bindValue(':tdate1', (string)$target['submitted_at'], PDO::PARAM_STR); $count->bindValue(':tdate2', (string)$target['submitted_at'], PDO::PARAM_STR); $count->bindValue(':tid', (string)$target['id'], PDO::PARAM_STR); $count->execute(); $rank = (int)$count->fetchColumn() + 1;
        }
    }
    return ['rows' => $rows, 'player_rank' => $rank];
}

try {
    $configPath = __DIR__ . '/config.php';
    if (!is_file($configPath)) api_fail(503, 'setup_required', '랭킹 서버 설정이 필요합니다. 게임은 로컬 모드로 계속 플레이할 수 있습니다.');
    $config = require $configPath; $pdo = database($config); $action = (string)($_GET['action'] ?? '');
    if ($action === 'leaderboard') {
        require_method('GET'); rate_limit($pdo, $config, 'parry-leaderboard', 90, 60);
        $mode = (string)($_GET['mode'] ?? 'daily'); if (!in_array($mode, ['daily','survival'], true)) api_fail(400, 'invalid_mode', '랭킹 모드가 올바르지 않습니다.');
        $date = $mode === 'daily' ? valid_challenge_date((string)($_GET['challenge_date'] ?? kst_today())) : null;
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 10))); $playerId = null;
        $playerKey = strtolower((string)($_COOKIE['playbox_player_token'] ?? ''));
        if (preg_match('/^[0-9a-f]{64}$/', $playerKey)) { $lookup = $pdo->prepare('SELECT id FROM players WHERE player_key_hash = :hash LIMIT 1'); $lookup->execute([':hash' => hash('sha256', $playerKey)]); $found = $lookup->fetchColumn(); if ($found !== false) $playerId = (string)$found; }
        $data = parry_leaderboard($pdo, $mode, $date, $limit, $playerId);
        api_ok(['mode' => $mode, 'challenge_date' => $date, 'rows' => $data['rows'], 'player_rank' => $data['player_rank']]);
    }
    require_method('POST'); rate_limit($pdo, $config, 'parry-write', 24, 60); $input = read_json_body();
    if ($action === 'profile') {
        $player = ensure_player($pdo, $input, true);
        $query = $pdo->prepare('SELECT mode, MAX(bosses_defeated) bosses_defeated, MAX(score) score FROM parry_runs WHERE player_id = :player AND rules_version = 2 AND status = \'verified\' GROUP BY mode'); $query->execute([':player' => $player['id']]);
        $records = ['survival' => ['bosses_defeated' => 0, 'score' => 0], 'daily' => ['bosses_defeated' => 0, 'score' => 0]];
        foreach ($query->fetchAll() as $row) $records[$row['mode']] = ['bosses_defeated' => (int)$row['bosses_defeated'], 'score' => (int)$row['score']];
        api_ok(['player_id' => $player['id'], 'nickname' => $player['nickname'], 'records' => $records]);
    }
    if ($action === 'start') {
        rate_limit($pdo, $config, 'parry-start', 8, 60); $player = ensure_player($pdo, $input, true); $mode = (string)($input['mode'] ?? 'survival');
        if (!in_array($mode, ['survival','daily'], true)) api_fail(400, 'invalid_mode', '랭킹 모드가 올바르지 않습니다.');
        $date = $mode === 'daily' ? valid_challenge_date((string)($input['challenge_date'] ?? kst_today())) : null;
        if ($mode === 'daily' && $date !== kst_today()) api_fail(409, 'challenge_closed', '오늘의 검성전만 랭킹에 등록할 수 있습니다.');
        $seed = $mode === 'daily' ? parry_daily_seed($pdo, $config, $date) : random_int(1, 4294967295);
        $runId = uuid_v4(); $runToken = bin2hex(random_bytes(32));
        $insert = $pdo->prepare('INSERT INTO parry_runs (id, player_id, run_token_hash, mode, challenge_date, seed, rules_version, status, started_at) VALUES (:id, :player, :token, :mode, :date, :seed, 2, \'active\', UTC_TIMESTAMP(3))');
        $insert->execute([':id' => $runId, ':player' => $player['id'], ':token' => hash('sha256', $runToken), ':mode' => $mode, ':date' => $date, ':seed' => $seed]);
        api_ok(['run_id' => $runId, 'run_token' => $runToken, 'player_id' => $player['id'], 'nickname' => $player['nickname'], 'mode' => $mode, 'challenge_date' => $date, 'seed' => $seed, 'rules_version' => 2]);
    }
    if ($action === 'abandon') {
        $key = request_player_key(); $runId = (string)($input['run_id'] ?? ''); $token = (string)($input['run_token'] ?? '');
        if (!preg_match('/^[0-9a-f-]{36}$/i', $runId) || !preg_match('/^[0-9a-f]{64}$/i', $token)) api_fail(400, 'invalid_run', '전투 세션 정보가 올바르지 않습니다.');
        $query = $pdo->prepare('UPDATE parry_runs SET status = \'abandoned\', submitted_at = UTC_TIMESTAMP(3) WHERE id = :id AND run_token_hash = :token AND status = \'active\' AND player_id = (SELECT id FROM players WHERE player_key_hash = :key LIMIT 1)');
        $query->execute([':id' => $runId, ':token' => hash('sha256', $token), ':key' => hash('sha256', $key)]); api_ok(['abandoned' => $query->rowCount() === 1]);
    }
    if ($action === 'submit') {
        rate_limit($pdo, $config, 'parry-submit', 8, 60); $key = request_player_key(); $runId = (string)($input['run_id'] ?? ''); $token = (string)($input['run_token'] ?? '');
        if (!preg_match('/^[0-9a-f-]{36}$/i', $runId) || !preg_match('/^[0-9a-f]{64}$/i', $token)) api_fail(400, 'invalid_run', '전투 세션 정보가 올바르지 않습니다.');
        $pdo->beginTransaction();
        $query = $pdo->prepare('SELECT r.*, p.nickname FROM parry_runs r JOIN players p ON p.id = r.player_id WHERE r.id = :id AND p.player_key_hash = :key AND r.run_token_hash = :token FOR UPDATE');
        $query->execute([':id' => $runId, ':key' => hash('sha256', $key), ':token' => hash('sha256', $token)]); $run = $query->fetch();
        if (!$run) { $pdo->rollBack(); api_fail(404, 'run_not_found', '전투 세션을 찾지 못했습니다.'); }
        if ($run['status'] !== 'active') { $pdo->rollBack(); api_fail(409, 'run_already_submitted', '이미 제출된 전투입니다.'); }
        if ((int)$run['rules_version'] !== 2 || ($run['mode'] === 'daily' && $run['challenge_date'] !== kst_today())) { $pdo->rollBack(); api_fail(409, 'challenge_closed', '현재 규칙과 날짜에 맞지 않는 전투입니다.'); }
        $events = $input['events'] ?? null; if (!is_array($events)) { $pdo->rollBack(); api_fail(422, 'invalid_events', '전투 기록을 읽을 수 없습니다.'); }
        $result = parry_verify_run((int)$run['seed'], $events);
        $started = strtotime((string)$run['started_at'] . ' UTC'); $duration = max(0, (int)round(microtime(true) * 1000 - ((float)$started * 1000)));
        $lastElapsed = (int)($events[count($events)-1]['elapsed_ms'] ?? 0);
        if ($duration < 2500 || $lastElapsed > $duration + 2500 || $duration > 36000000) { $pdo->rollBack(); api_fail(422, 'implausible_duration', '전투 진행 시간이 유효하지 않습니다.'); }
        $update = $pdo->prepare('UPDATE parry_runs SET status = \'verified\', bosses_defeated = :bosses, last_boss_parries = :parries, score = :score, perfect_rate = :rate, best_combo = :combo, perfect_count = :perfect, good_count = :good, miss_count = :miss, total_attacks = :total, duration_ms = :duration, events_json = :events, submitted_at = UTC_TIMESTAMP(3) WHERE id = :id AND status = \'active\'');
        $update->execute([':bosses' => $result['bosses_defeated'], ':parries' => $result['last_boss_parries'], ':score' => $result['score'], ':rate' => $result['perfect_rate'], ':combo' => $result['best_combo'], ':perfect' => $result['perfects'], ':good' => $result['goods'], ':miss' => $result['misses'], ':total' => $result['total_attacks'], ':duration' => $duration, ':events' => json_encode($events, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ':id' => $runId]);
        $pdo->commit(); $scope = $run['mode']; $ranking = parry_leaderboard($pdo, $scope, $run['challenge_date'], 100, (string)$run['player_id']);
        api_ok(['player_id' => $run['player_id'], 'mode' => $run['mode'], 'player_rank' => $ranking['player_rank'], 'result' => $result]);
    }
    api_fail(404, 'unknown_action', '요청한 PARRY API 기능을 찾을 수 없습니다.');
} catch (ApiException $exception) {
    api_fail($exception->status, $exception->errorCode, $exception->getMessage());
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[Playbox PARRY API] ' . $exception->getMessage());
    api_fail(500, 'server_error', '서버에서 전투 기록을 처리하지 못했습니다.');
}
