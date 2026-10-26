<?php
declare(strict_types=1);

define('PLAYBOX_API_BOOTSTRAPPED', true);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

require_once __DIR__ . '/lib.php';

try {
    $configPath = __DIR__ . '/config.php';
    if (!is_file($configPath)) {
        api_fail(503, 'setup_required', '랭킹 서버 설정이 필요합니다. 게임은 로컬 모드로 계속 플레이할 수 있습니다.');
    }
    $config = require $configPath;
    $pdo = database($config);
    $action = (string)($_GET['action'] ?? '');

    if ($action === 'leaderboard') {
        require_method('GET');
        rate_limit($pdo, $config, 'leaderboard', 90, 60);
        $mode = (string)($_GET['mode'] ?? 'daily');
        if (!in_array($mode, ['daily', 'survival'], true)) {
            api_fail(400, 'invalid_mode', '올바르지 않은 랭킹 모드입니다.');
        }
        $date = $mode === 'daily'
            ? valid_challenge_date((string)($_GET['challenge_date'] ?? kst_today()))
            : null;
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 10)));
        $playerId = preg_match('/^[0-9a-f-]{36}$/i', (string)($_GET['player_id'] ?? ''))
            ? (string)$_GET['player_id'] : null;
        $rows = leaderboard_rows($pdo, $mode, $date, $limit);
        $playerRank = $playerId !== null ? personal_rank($pdo, $mode, $date, $playerId) : null;
        api_ok([
            'mode' => $mode,
            'challenge_date' => $date,
            'rows' => $rows,
            'player_rank' => $playerRank,
            'message' => count($rows) === 0 ? '아직 등록된 기록이 없어. 첫 번째 기록에 도전해봐!' : '',
        ]);
    }

    require_method('POST');
    rate_limit($pdo, $config, 'write', 24, 60);
    $input = read_json_body();

    if ($action === 'profile') {
        $player = ensure_player($pdo, $input, true);
        $date = kst_today();
        api_ok([
            'player_id' => $player['id'],
            'nickname' => $player['nickname'],
            'records' => [
                'survival' => personal_best($pdo, $player['id'], 'survival', null),
                'daily' => personal_best($pdo, $player['id'], 'daily', $date),
            ],
        ]);
    }

    if ($action === 'start') {
        rate_limit($pdo, $config, 'start', 8, 60);
        $player = ensure_player($pdo, $input, true);
        $mode = (string)($input['mode'] ?? 'survival');
        if (!in_array($mode, ['survival', 'daily'], true)) {
            api_fail(400, 'invalid_mode', '올바르지 않은 게임 모드입니다.');
        }
        $challengeDate = $mode === 'daily'
            ? valid_challenge_date((string)($input['challenge_date'] ?? kst_today()))
            : null;
        if ($mode === 'daily' && $challengeDate !== kst_today()) {
            api_fail(409, 'challenge_closed', '지난 도전은 기록 확인만 가능하며 새 랭킹 기록은 등록할 수 없습니다.');
        }
        $seed = $mode === 'daily'
            ? daily_seed($pdo, $config, $challengeDate)
            : random_int(1, 4294967295);
        $runId = uuid_v4();
        $runToken = bin2hex(random_bytes(32));
        $statement = $pdo->prepare(
            'INSERT INTO game_runs (id, player_id, run_token_hash, mode, challenge_date, seed, rules_version, status, started_at) '
            . 'VALUES (:id, :player_id, :token_hash, :mode, :challenge_date, :seed, 3, \'active\', UTC_TIMESTAMP(3))'
        );
        $statement->execute([
            ':id' => $runId,
            ':player_id' => $player['id'],
            ':token_hash' => hash('sha256', $runToken),
            ':mode' => $mode,
            ':challenge_date' => $challengeDate,
            ':seed' => $seed,
        ]);
        api_ok([
            'run_id' => $runId,
            'run_token' => $runToken,
            'player_id' => $player['id'],
            'nickname' => $player['nickname'],
            'mode' => $mode,
            'challenge_date' => $challengeDate,
            'seed' => $seed,
            'rules_version' => 3,
        ]);
    }

    if ($action === 'abandon') {
        $playerKey = request_player_key();
        $runId = (string)($input['run_id'] ?? '');
        $runToken = (string)($input['run_token'] ?? '');
        if (!preg_match('/^[0-9a-f-]{36}$/i', $runId) || !preg_match('/^[0-9a-f]{64}$/i', $runToken)) {
            api_fail(400, 'invalid_run', '게임 세션 정보가 올바르지 않습니다.');
        }
        $abandon = $pdo->prepare(
            'UPDATE game_runs SET status = \'abandoned\', submitted_at = UTC_TIMESTAMP(3) '
            . 'WHERE id = :id AND run_token_hash = :token_hash AND status = \'active\' '
            . 'AND player_id = (SELECT id FROM players WHERE player_key_hash = :player_key_hash LIMIT 1)'
        );
        $abandon->execute([
            ':id' => $runId,
            ':token_hash' => hash('sha256', $runToken),
            ':player_key_hash' => hash('sha256', $playerKey),
        ]);
        api_ok(['abandoned' => $abandon->rowCount() === 1]);
    }

    if ($action === 'submit') {
        rate_limit($pdo, $config, 'submit', 8, 60);
        $playerKey = request_player_key();
        $runId = (string)($input['run_id'] ?? '');
        $runToken = (string)($input['run_token'] ?? '');
        if (!preg_match('/^[0-9a-f-]{36}$/i', $runId) || !preg_match('/^[0-9a-f]{64}$/i', $runToken)) {
            api_fail(400, 'invalid_run', '게임 세션 정보가 올바르지 않습니다.');
        }
        $pdo->beginTransaction();
        $statement = $pdo->prepare(
            'SELECT r.*, p.nickname FROM game_runs r JOIN players p ON p.id = r.player_id '
            . 'WHERE r.id = :id AND p.player_key_hash = :player_key_hash AND r.run_token_hash = :run_token_hash FOR UPDATE'
        );
        $statement->execute([
            ':id' => $runId,
            ':player_key_hash' => hash('sha256', $playerKey),
            ':run_token_hash' => hash('sha256', $runToken),
        ]);
        $run = $statement->fetch();
        if (!$run) {
            $pdo->rollBack();
            api_fail(404, 'run_not_found', '게임 세션을 찾을 수 없습니다.');
        }
        if ($run['status'] !== 'active') {
            $pdo->rollBack();
            api_fail(409, 'run_already_submitted', '이 게임 세션은 이미 제출되었습니다.');
        }
        if ((int)$run['rules_version'] !== 3 || ($run['mode'] === 'daily' && $run['challenge_date'] !== kst_today())) {
            $pdo->rollBack();
            api_fail(409, 'challenge_closed', '현재 규칙과 날짜에 맞지 않는 세션입니다.');
        }
        $events = $input['events'] ?? null;
        if (!is_array($events) || count($events) < 3 || count($events) > 5000) {
            $pdo->rollBack();
            api_fail(422, 'invalid_events', '게임 기록 형식이 올바르지 않습니다.');
        }
        $result = verify_run((int)$run['seed'], $events);
        $startedAt = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.v', (string)$run['started_at'], new DateTimeZone('UTC'));
        $elapsedMs = $startedAt ? max(0, (int)round((microtime(true) - (float)$startedAt->format('U.u')) * 1000)) : 0;
        $lastEventElapsed = (int)($events[count($events) - 1]['elapsed_ms'] ?? 0);
        if ($lastEventElapsed > $elapsedMs + 1000) {
            $pdo->rollBack();
            api_fail(422, 'event_after_submit', '마지막 입력 시간이 서버 세션 시간보다 늦습니다.');
        }
        if ($elapsedMs > 36000000) {
            $pdo->rollBack();
            api_fail(422, 'implausible_duration', '플레이 시간이 기록 검증 기준에 맞지 않습니다.');
        }
        if ($result['mistakes'] < 3) {
            $pdo->rollBack();
            api_fail(422, 'run_incomplete', '생명이 모두 소진된 게임만 랭킹에 등록할 수 있습니다.');
        }
        $update = $pdo->prepare(
            'UPDATE game_runs SET status = \'verified\', stage = :stage, score = :score, accuracy = :accuracy, '
            . 'avg_reaction_ms = :average_ms, best_reaction_ms = :best_reaction_ms, best_combo = :best_combo, mistakes = :mistakes, '
            . 'correct_count = :correct_count, wrong_count = :wrong_count, timeout_count = :timeout_count, '
            . 'questions_processed = :questions_processed, duration_ms = :duration_ms, events_json = :events_json, submitted_at = UTC_TIMESTAMP(3) '
            . 'WHERE id = :id AND status = \'active\''
        );
        $update->execute([
            ':stage' => $result['stage'],
            ':score' => $result['score'],
            ':accuracy' => $result['accuracy'],
            ':average_ms' => $result['average_ms'],
            ':best_reaction_ms' => $result['best_reaction_ms'],
            ':best_combo' => $result['best_combo'],
            ':mistakes' => $result['mistakes'],
            ':correct_count' => $result['correct'],
            ':wrong_count' => $result['wrong'],
            ':timeout_count' => $result['timeouts'],
            ':questions_processed' => count($events),
            ':duration_ms' => $elapsedMs,
            ':events_json' => json_encode($events, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':id' => $runId,
        ]);
        $pdo->commit();

        $scope = $run['mode'] === 'daily' ? 'daily' : 'survival';
        $rank = personal_rank($pdo, $scope, $run['challenge_date'], (string)$run['player_id']);
        api_ok([
            'player_id' => $run['player_id'],
            'mode' => $run['mode'],
            'rank' => $rank,
            'result' => $result,
            'message' => $rank === null ? '기록 검증 완료 · TOP 100 밖' : '',
        ]);
    }

    api_fail(404, 'unknown_action', '요청한 API 기능을 찾을 수 없습니다.');
} catch (ApiException $exception) {
    api_fail($exception->status, $exception->errorCode, $exception->getMessage());
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[Playbox API] ' . $exception->getMessage());
    api_fail(500, 'server_error', '서버에서 요청을 처리하지 못했습니다.');
}
