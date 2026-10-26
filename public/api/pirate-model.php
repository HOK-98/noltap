<?php
declare(strict_types=1);

// Alternate delivery for the three public game assets. No arbitrary paths,
// database access, cookies, or player data are accepted by this endpoint.
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
    header('Allow: GET, HEAD');
    http_response_code(405);
    exit;
}
$name = $_GET['name'] ?? '';
if (!is_string($name) || !in_array($name, ['barrel', 'pirate', 'knife'], true)) {
    http_response_code(404);
    exit;
}
$path = dirname(__DIR__) . '/models/' . $name . '.glb';
if (!is_file($path) || !is_readable($path)) {
    http_response_code(503);
    exit;
}
$etag = '"pirate-' . $name . '-' . filemtime($path) . '-' . filesize($path) . '"';
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=86400');
header('ETag: ' . $etag);
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') exit;
$bytes = file_get_contents($path);
if ($bytes === false) { http_response_code(503); exit; }
echo json_encode(['data' => base64_encode($bytes)], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
