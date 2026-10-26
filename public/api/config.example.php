<?php
declare(strict_types=1);

// Copy this file to config.php and enter the MySQL details from Hostinger.
// Direct web requests to this file are blocked by .htaccess and the bootstrap guard.
if (!defined('PLAYBOX_API_BOOTSTRAPPED')) {
    http_response_code(404);
    exit;
}

return [
    'db_host' => 'localhost',
    'db_name' => 'YOUR_DATABASE_NAME',
    'db_user' => 'YOUR_DATABASE_USER',
    'db_password' => 'YOUR_DATABASE_PASSWORD',
    'app_secret' => 'REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_48_CHARACTERS',
];
