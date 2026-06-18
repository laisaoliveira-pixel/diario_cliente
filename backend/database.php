<?php
/**
 * database.php
 * Conexão com MariaDB e criação das tabelas necessárias.
 */

// Função para carregar arquivo .env
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        putenv(trim($name) . '=' . trim($value));
    }
}

// Carrega o .env da raiz do projeto (uma pasta acima do backend)
loadEnv(dirname(__DIR__) . '/.env');

// ── Configuração de conexão MariaDB ──────────────────────────────
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'diario_clientes');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST, DB_PORT, DB_NAME
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // Define charset utf8mb4 sem depender de constante específica do driver
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

    initSchema($pdo);
    return $pdo;
}

function initSchema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            name          VARCHAR(120) NOT NULL,
            email         VARCHAR(180) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role          VARCHAR(20) NOT NULL DEFAULT 'analista',
            active        TINYINT(1) NOT NULL DEFAULT 1,
            criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Garante que o admin padrão existe
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
    $stmt->execute(['admin@bernhoeft.com.br']);
    if ((int)$stmt->fetchColumn() === 0) {
        $hash = password_hash('Admin@1234', PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)")
            ->execute(['Administrador', 'admin@bernhoeft.com.br', $hash, 'admin']);
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS empresas (
            id            VARCHAR(50) PRIMARY KEY,
            nome_social   VARCHAR(255),
            cnpj_matriz   VARCHAR(20) UNIQUE,
            dados_json    LONGTEXT NOT NULL,
            criado_em     DATETIME DEFAULT NOW(),
            atualizado_em DATETIME DEFAULT NOW(),
            excluido_em   DATETIME DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS gatilhos (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            empresa_id  VARCHAR(50) NOT NULL,
            data        VARCHAR(20),
            motivo      TEXT,
            descricao   TEXT,
            criado_em   DATETIME DEFAULT NOW(),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS checklist (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            empresa_id      VARCHAR(50) UNIQUE NOT NULL,
            sugestao_raw    TEXT DEFAULT (''),
            criterios_raw   TEXT DEFAULT (''),
            sugestoes_json  LONGTEXT,
            criterios_json  LONGTEXT,
            atualizado_em   DATETIME DEFAULT NOW(),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS incidencias (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            empresa_id  VARCHAR(50) NOT NULL,
            data        VARCHAR(20),
            tipo        VARCHAR(100),
            descricao   TEXT,
            checked     TINYINT(1) DEFAULT 0,
            criado_em   DATETIME DEFAULT NOW(),
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}
