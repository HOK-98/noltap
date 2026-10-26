<?php
declare(strict_types=1);

if (!defined('PLAYBOX_API_BOOTSTRAPPED')) {
    http_response_code(404);
    exit;
}

final class ApiException extends RuntimeException
{
    public int $status;
    public string $errorCode;

    public function __construct(int $status, string $errorCode, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
    }
}

function api_ok(array $data = []): never
{
    http_response_code(200);
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}

function api_fail(int $status, string $errorCode, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $errorCode, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}

function database(array $config): PDO
{
    foreach (['db_host', 'db_name', 'db_user', 'db_password', 'app_secret'] as $key) {
        if (!isset($config[$key]) || $config[$key] === '' || str_starts_with((string)$config[$key], 'YOUR_') || str_starts_with((string)$config[$key], 'REPLACE_')) {
            api_fail(503, 'setup_required', 'api/config.php에 Hostinger DB 접속 정보를 입력해주세요.');
        }
    }
    $dsn = 'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4';
    return new PDO($dsn, (string)$config['db_user'], (string)$config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function require_method(string $method): void
{
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== $method) {
        header('Allow: ' . $method);
        api_fail(405, 'method_not_allowed', '요청 방식이 올바르지 않습니다.');
    }
}

function read_json_body(): array
{
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > 2000000) {
        api_fail(413, 'payload_too_large', '요청 데이터가 너무 큽니다.');
    }
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        api_fail(400, 'invalid_json', '요청 데이터를 읽을 수 없습니다.');
    }
    return $data;
}

function rate_limit(PDO $pdo, array $config, string $route, int $maximum, int $windowSeconds): void
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ipHash = hash_hmac('sha256', $ip, (string)$config['app_secret']);
    $seconds = max(1, min(3600, $windowSeconds));
    $statement = $pdo->prepare(
        'INSERT INTO api_rate_limits (ip_hash, route_key, window_started, hit_count) VALUES (:ip_hash, :route_key, UTC_TIMESTAMP(), 1) '
        . 'ON DUPLICATE KEY UPDATE '
        . 'hit_count = IF(window_started < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $seconds . ' SECOND), 1, hit_count + 1), '
        . 'window_started = IF(window_started < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $seconds . ' SECOND), UTC_TIMESTAMP(), window_started)'
    );
    $statement->execute([':ip_hash' => $ipHash, ':route_key' => $route]);
    $read = $pdo->prepare('SELECT hit_count FROM api_rate_limits WHERE ip_hash = :ip_hash AND route_key = :route_key');
    $read->execute([':ip_hash' => $ipHash, ':route_key' => $route]);
    if ((int)$read->fetchColumn() > $maximum) {
        api_fail(429, 'rate_limited', '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
    }
}

function valid_player_key(mixed $key): string
{
    $key = strtolower((string)$key);
    if (!preg_match('/^[0-9a-f]{64}$/', $key)) {
        api_fail(400, 'invalid_player_key', '익명 플레이어 식별자가 올바르지 않습니다.');
    }
    return $key;
}

function request_player_key(): string
{
    $key = strtolower((string)($_COOKIE['playbox_player_token'] ?? ''));
    if (preg_match('/^[0-9a-f]{64}$/', $key)) return $key;

    $key = bin2hex(random_bytes(32));
    $secure = isset($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off' && (string)$_SERVER['HTTPS'] !== '';
    setcookie('playbox_player_token', $key, [
        'expires' => time() + 60 * 60 * 24 * 365 * 5,
        'path' => '/api',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $_COOKIE['playbox_player_token'] = $key;
    return $key;
}

function clean_nickname(mixed $nickname): string
{
    $nickname = strip_tags((string)$nickname);
    $nickname = preg_replace('/[\p{C}]/u', '', $nickname) ?? '';
    $nickname = preg_replace('/\s+/u', ' ', trim($nickname)) ?? '';
    $length = preg_match_all('/./us', $nickname, $matches);
    if ($length === false) $length = 0;
    if ($length < 2 || $length > 16) {
        api_fail(422, 'invalid_nickname', '닉네임은 2~16자로 입력해주세요.');
    }
    return $nickname;
}

function ensure_player(PDO $pdo, array $input, bool $allowNicknameUpdate): array
{
    $key = request_player_key();
    $keyHash = hash('sha256', $key);
    $nickname = isset($input['nickname']) && trim((string)$input['nickname']) !== ''
        ? clean_nickname($input['nickname']) : null;
    $lookup = $pdo->prepare('SELECT id, nickname FROM players WHERE player_key_hash = :key_hash LIMIT 1');
    $lookup->execute([':key_hash' => $keyHash]);
    $player = $lookup->fetch();
    if ($player) {
        if ($allowNicknameUpdate && $nickname !== null && $nickname !== $player['nickname']) {
            $update = $pdo->prepare('UPDATE players SET nickname = :nickname, updated_at = UTC_TIMESTAMP() WHERE id = :id');
            $update->execute([':nickname' => $nickname, ':id' => $player['id']]);
            $player['nickname'] = $nickname;
        }
        return $player;
    }
    $nickname ??= '플레이어';
    $id = uuid_v4();
    $insert = $pdo->prepare('INSERT INTO players (id, player_key_hash, nickname, created_at, updated_at) VALUES (:id, :key_hash, :nickname, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
    try {
        $insert->execute([':id' => $id, ':key_hash' => $keyHash, ':nickname' => $nickname]);
    } catch (PDOException $exception) {
        if ($exception->getCode() !== '23000') throw $exception;
        $lookup->execute([':key_hash' => $keyHash]);
        $player = $lookup->fetch();
        if (!$player) throw $exception;
        return $player;
    }
    return ['id' => $id, 'nickname' => $nickname];
}

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

function kst_today(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul')))->format('Y-m-d');
}

function valid_challenge_date(string $date): string
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Asia/Seoul'));
    $errors = DateTimeImmutable::getLastErrors();
    if (!$parsed || ($errors && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) || $parsed->format('Y-m-d') !== $date) {
        api_fail(400, 'invalid_challenge_date', '오늘의 도전 날짜가 올바르지 않습니다.');
    }
    if ($date > kst_today()) {
        api_fail(400, 'future_challenge_date', '아직 시작하지 않은 도전 날짜입니다.');
    }
    return $date;
}

function daily_seed(PDO $pdo, array $config, string $date): int
{
    $lookup = $pdo->prepare('SELECT seed, rules_version FROM daily_challenges WHERE challenge_date = :challenge_date LIMIT 1');
    $lookup->execute([':challenge_date' => $date]);
    $stored = $lookup->fetch();
    if ($stored && (int)$stored['rules_version'] === 3) return (int)$stored['seed'];

    $seed = (int)hexdec(substr(hash_hmac('sha256', 'playbox-stroop-daily-v3:' . $date, (string)$config['app_secret']), 0, 8));
    if ($seed === 0) $seed = 1831565813;
    $insert = $pdo->prepare('INSERT INTO daily_challenges (challenge_date, seed, rules_version, created_at) VALUES (:challenge_date, :seed, 3, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE seed = VALUES(seed), rules_version = 3');
    $insert->execute([':challenge_date' => $date, ':seed' => $seed]);
    $lookup->execute([':challenge_date' => $date]);
    return (int)$lookup->fetch()['seed'];
}

function pattern_random(int &$value): float
{
    $value = ($value ^ (($value << 13) & 0xffffffff)) & 0xffffffff;
    $value = ($value ^ ($value >> 17)) & 0xffffffff;
    $value = ($value ^ (($value << 5) & 0xffffffff)) & 0xffffffff;
    return $value / 4294967296;
}

function limit_for_question(int $questionNumber): int
{
    $questionNumber = max(1, $questionNumber);
    return max(1000, 3000 - intdiv($questionNumber - 1, 3) * 100);
}

function next_question(int &$value, int $index): array
{
    $wordIndex = (int)floor(pattern_random($value) * 4);
    $colorIndex = (int)floor(pattern_random($value) * 4);
    $backgroundIndex = null;
    if ($index + 1 >= 31) {
        do { $backgroundIndex = (int)floor(pattern_random($value) * 4); }
        while ($backgroundIndex === $colorIndex || $backgroundIndex === $wordIndex);
    }
    return [
        'index' => $index,
        'stage' => intdiv($index, 5) + 1,
        'word_index' => $wordIndex,
        'color_index' => $colorIndex,
        'background_index' => $backgroundIndex,
        'limit_ms' => limit_for_question($index + 1),
    ];
}

function question_at(int $seed, int $requestedIndex): array
{
    $value = $seed & 0xffffffff;
    if ($value === 0) $value = 0x6d2b79f5;
    $question = [];
    for ($index = 0; $index <= $requestedIndex; $index++) {
        $question = next_question($value, $index);
    }
    return $question;
}

function verify_run(int $seed, array $events): array
{
    $score = 0;
    $combo = 0;
    $bestCombo = 0;
    $correct = 0;
    $wrong = 0;
    $timeouts = 0;
    $reactionTimes = [];
    $previousElapsed = null;
    $randomState = $seed & 0xffffffff;
    if ($randomState === 0) $randomState = 0x6d2b79f5;

    foreach ($events as $index => $event) {
        if (!is_array($event) || (int)($event['question_index'] ?? -1) !== $index) {
            api_fail(422, 'invalid_event_order', '문제 기록 순서가 올바르지 않습니다.');
        }
        $question = next_question($randomState, $index);
        if ((int)($event['stage'] ?? 0) !== $question['stage']) {
            api_fail(422, 'invalid_stage', '스테이지 기록이 문제 순서와 일치하지 않습니다.');
        }
        $kind = (string)($event['kind'] ?? '');
        $choice = isset($event['choice_index']) && is_numeric($event['choice_index']) ? (int)$event['choice_index'] : null;
        $reaction = isset($event['reaction_ms']) && is_numeric($event['reaction_ms']) ? (int)$event['reaction_ms'] : null;
        $elapsed = isset($event['elapsed_ms']) && is_numeric($event['elapsed_ms']) ? (int)$event['elapsed_ms'] : null;
        if ($elapsed === null || $elapsed < 0 || $elapsed > 36000000) {
            api_fail(422, 'invalid_event_time', '입력 시간 기록이 올바르지 않습니다.');
        }
        $questionStart = $index === 0 ? 3000 : (int)$previousElapsed;
        if ($kind === 'correct' || $kind === 'wrong') {
            if ($choice === null || $choice < 0 || $choice > 3 || $reaction === null || $reaction < 50 || $reaction >= $question['limit_ms']) {
                api_fail(422, 'invalid_answer', '응답 선택 또는 반응 시간이 올바르지 않습니다.');
            }
            if ($elapsed < $questionStart + $reaction - 100 || $elapsed > $questionStart + $reaction + 1500) {
                api_fail(422, 'impossible_answer_time', '응답 시각과 반응 시간이 일치하지 않습니다.');
            }
            $isCorrect = $choice === $question['color_index'];
            if (($kind === 'correct') !== $isCorrect) {
                api_fail(422, 'answer_mismatch', '정답 판정이 색상 문제와 일치하지 않습니다.');
            }
            if ($isCorrect) {
                $correct++;
                $combo++;
                $bestCombo = max($bestCombo, $combo);
                $reactionTimes[] = $reaction;
                $speedBonus = max(0, min(100, (int)floor(100 * (1 - $reaction / $question['limit_ms']))));
                $comboBonus = min(50, max(0, ($combo - 1) * 5));
                $score += 100 + $speedBonus + $comboBonus;
            } else {
                $wrong++;
                $combo = 0;
            }
        } elseif ($kind === 'timeout') {
            if ($choice !== null || $reaction !== null || $elapsed < $questionStart + $question['limit_ms'] - 35) {
                api_fail(422, 'invalid_timeout', '시간 초과 기록이 문제 제한시간과 일치하지 않습니다.');
            }
            $timeouts++;
            $combo = 0;
        } else {
            api_fail(422, 'unknown_event', '알 수 없는 게임 입력 기록입니다.');
        }

        if ($elapsed < $questionStart || ($previousElapsed !== null && $elapsed < $previousElapsed)) {
            api_fail(422, 'non_monotonic_time', '문제 처리 시간 순서가 올바르지 않습니다.');
        }
        $previousElapsed = $elapsed;
        if ($wrong + $timeouts >= 3 && $index !== count($events) - 1) {
            api_fail(422, 'events_after_game_over', '게임 종료 후 추가 문제가 포함되어 있습니다.');
        }
    }

    $average = count($reactionTimes) ? (int)round(array_sum($reactionTimes) / count($reactionTimes)) : null;
    return [
        'questions_processed' => count($events),
        'stage' => intdiv(max(0, count($events) - 1), 5) + 1,
        'score' => $score,
        'accuracy' => count($events) ? round($correct / count($events) * 100, 2) : 0,
        'average_ms' => $average,
        'best_reaction_ms' => count($reactionTimes) ? min($reactionTimes) : null,
        'best_combo' => $bestCombo,
        'mistakes' => $wrong + $timeouts,
        'correct' => $correct,
        'wrong' => $wrong,
        'timeouts' => $timeouts,
    ];
}

function leaderboard_rows(PDO $pdo, string $mode, ?string $date, int $limit): array
{
    $dateWhere = $mode === 'daily' ? 'r.challenge_date = :challenge_date' : 'r.challenge_date IS NULL';
    $sql = 'SELECT r.player_id, p.nickname, r.stage, r.questions_processed, r.score, r.accuracy, r.avg_reaction_ms, r.best_combo, r.submitted_at '
        . 'FROM game_runs r JOIN players p ON p.id = r.player_id '
        . 'WHERE r.mode = :mode AND r.rules_version = 3 AND r.status = \'verified\' AND ' . $dateWhere . ' '
        . 'AND NOT EXISTS (SELECT 1 FROM game_runs b WHERE b.player_id = r.player_id AND b.mode = r.mode '
        . 'AND b.challenge_date <=> r.challenge_date AND b.rules_version = 3 AND b.status = \'verified\' AND '
        . '(b.questions_processed > r.questions_processed OR (b.questions_processed = r.questions_processed AND b.score > r.score) '
        . 'OR (b.questions_processed = r.questions_processed AND b.score = r.score AND b.accuracy > r.accuracy) '
        . 'OR (b.questions_processed = r.questions_processed AND b.score = r.score AND b.accuracy = r.accuracy AND (b.submitted_at < r.submitted_at OR (b.submitted_at = r.submitted_at AND b.id < r.id))))) '
        . 'ORDER BY r.questions_processed DESC, r.score DESC, r.accuracy DESC, r.submitted_at ASC, r.id ASC LIMIT :limit';
    $statement = $pdo->prepare($sql);
    $statement->bindValue(':mode', $mode, PDO::PARAM_STR);
    if ($mode === 'daily') $statement->bindValue(':challenge_date', $date, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->execute();
    $rows = $statement->fetchAll();
    foreach ($rows as $index => &$row) {
        $row['rank'] = $index + 1;
        $row['stage'] = (int)$row['stage'];
        $row['questions_processed'] = (int)$row['questions_processed'];
        $row['score'] = (int)$row['score'];
        $row['accuracy'] = (float)$row['accuracy'];
        $row['best_combo'] = (int)$row['best_combo'];
        unset($row['submitted_at']);
    }
    unset($row);
    return $rows;
}

function personal_rank(PDO $pdo, string $mode, ?string $date, string $playerId): ?int
{
    $dateWhere = $mode === 'daily' ? 'challenge_date = :challenge_date' : 'challenge_date IS NULL';
    $targetQuery = $pdo->prepare(
        'SELECT id, questions_processed, score, accuracy, submitted_at FROM game_runs '
        . 'WHERE player_id = :player_id AND mode = :mode AND rules_version = 3 AND status = \'verified\' AND ' . $dateWhere . ' '
        . 'ORDER BY questions_processed DESC, score DESC, accuracy DESC, submitted_at ASC, id ASC LIMIT 1'
    );
    $targetQuery->bindValue(':player_id', $playerId, PDO::PARAM_STR);
    $targetQuery->bindValue(':mode', $mode, PDO::PARAM_STR);
    if ($mode === 'daily') $targetQuery->bindValue(':challenge_date', $date, PDO::PARAM_STR);
    $targetQuery->execute();
    $target = $targetQuery->fetch();
    if (!$target) return null;

    $countQuery = $pdo->prepare(
        'SELECT COUNT(DISTINCT r.player_id) FROM game_runs r '
        . 'WHERE r.mode = :mode AND r.rules_version = 3 AND r.status = \'verified\' AND ' . ($mode === 'daily' ? 'r.challenge_date = :challenge_date' : 'r.challenge_date IS NULL') . ' '
        . 'AND (r.questions_processed > :count_1 OR (r.questions_processed = :count_2 AND r.score > :score_1) '
        . 'OR (r.questions_processed = :count_3 AND r.score = :score_2 AND r.accuracy > :accuracy_1) '
        . 'OR (r.questions_processed = :count_4 AND r.score = :score_3 AND r.accuracy = :accuracy_2 '
        . 'AND (r.submitted_at < :submitted_at OR (r.submitted_at = :submitted_at_tie AND r.id < :id))))'
    );
    $countQuery->bindValue(':mode', $mode, PDO::PARAM_STR);
    if ($mode === 'daily') $countQuery->bindValue(':challenge_date', $date, PDO::PARAM_STR);
    foreach ([':count_1', ':count_2', ':count_3', ':count_4'] as $placeholder) {
        $countQuery->bindValue($placeholder, (int)$target['questions_processed'], PDO::PARAM_INT);
    }
    foreach ([':score_1', ':score_2', ':score_3'] as $placeholder) {
        $countQuery->bindValue($placeholder, (int)$target['score'], PDO::PARAM_INT);
    }
    foreach ([':accuracy_1', ':accuracy_2'] as $placeholder) {
        $countQuery->bindValue($placeholder, (string)$target['accuracy'], PDO::PARAM_STR);
    }
    $countQuery->bindValue(':submitted_at', $target['submitted_at'], PDO::PARAM_STR);
    $countQuery->bindValue(':submitted_at_tie', $target['submitted_at'], PDO::PARAM_STR);
    $countQuery->bindValue(':id', $target['id'], PDO::PARAM_STR);
    $countQuery->execute();
    return (int)$countQuery->fetchColumn() + 1;
}

function personal_best(PDO $pdo, string $playerId, string $mode, ?string $date): array
{
    $dateWhere = $mode === 'daily' ? 'challenge_date = :challenge_date' : 'challenge_date IS NULL';
    $sql = 'SELECT stage, questions_processed, score, accuracy, avg_reaction_ms, best_reaction_ms, best_combo FROM game_runs '
        . 'WHERE player_id = :player_id AND mode = :mode AND rules_version = 3 AND status = \'verified\' AND ' . $dateWhere . ' '
        . 'ORDER BY questions_processed DESC, score DESC, accuracy DESC LIMIT 1';
    $statement = $pdo->prepare($sql);
    $statement->bindValue(':player_id', $playerId, PDO::PARAM_STR);
    $statement->bindValue(':mode', $mode, PDO::PARAM_STR);
    if ($mode === 'daily') $statement->bindValue(':challenge_date', $date, PDO::PARAM_STR);
    $statement->execute();
    $record = $statement->fetch();
    if (!$record) return ['stage' => 0, 'questions' => 0, 'score' => 0, 'accuracy' => 0, 'average_ms' => null, 'best_reaction_ms' => null, 'best_combo' => 0];
    return [
        'stage' => (int)$record['stage'],
        'questions' => (int)$record['questions_processed'],
        'score' => (int)$record['score'],
        'accuracy' => (float)$record['accuracy'],
        'average_ms' => $record['avg_reaction_ms'] === null ? null : (int)$record['avg_reaction_ms'],
        'best_reaction_ms' => $record['best_reaction_ms'] === null ? null : (int)$record['best_reaction_ms'],
        'best_combo' => (int)$record['best_combo'],
    ];
}
