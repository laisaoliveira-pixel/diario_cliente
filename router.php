<?php
/**
 * index.php  (raiz do servidor PHP)
 * Servidor de arquivos estáticos + proxy para a API backend.
 *
 * Inicialize com:
 *   php -S localhost:8080 index.php
 */

$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$base   = __DIR__;
$file   = $base . $uri;

// Rota /api/* → delega para backend/api.php
if (str_starts_with($uri, '/api')) {
    // Passa $_GET intacto
    require_once __DIR__ . '/backend/api.php';
    return;
}

// Serve arquivos estáticos existentes (css, js, imagens…)
if ($uri !== '/' && file_exists($file) && !is_dir($file)) {
    return false; // deixa o servidor embutido servir diretamente
}

// Rota padrão: serve index.html da pasta raiz
$html = $base . '/index.html';
if (file_exists($html)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($html);
} else {
    http_response_code(404);
    echo '404 – index.html not found';
}
