<?php
/**
 * api.php
 * API REST em PHP puro com MariaDB.
 * Rotas:
 *   GET    /api.php?action=listar_empresas
 *   GET    /api.php?action=obter_empresa&id=<id>
 *   POST   /api.php?action=salvar_empresa         body: JSON completo da empresa
 *   DELETE /api.php?action=excluir_empresa&id=<id>
 *
 *   GET    /api.php?action=listar_gatilhos&empresa_id=<id>
 *   POST   /api.php?action=salvar_gatilho          body: {empresa_id,data,motivo,descricao}
 *
 *   GET    /api.php?action=obter_checklist&empresa_id=<id>
 *   POST   /api.php?action=salvar_checklist        body: {empresa_id,sugestao_raw,criterios_raw,sugestoes_json,criterios_json}
 *
 *   GET    /api.php?action=listar_incidencias&empresa_id=<id>
 *   POST   /api.php?action=salvar_incidencia       body: {empresa_id,data,tipo,descricao}
 *   POST   /api.php?action=toggle_incidencia       body: {id,checked}
 *   DELETE /api.php?action=excluir_incidencia&id=<id>
 *   DELETE /api.php?action=limpar_incidencias&empresa_id=<id>
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Evita que erros/avisos do PHP sejam impressos como HTML e quebrem o JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/database.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Lê body JSON para POST
$body = [];
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}

try {
    $db = getDB();
    $result = null;

    // ============================================================
    // EMPRESAS
    // ============================================================
    if ($action === 'listar_empresas') {
        $stmt = $db->query("SELECT id, nome_social, cnpj_matriz, dados_json, atualizado_em FROM empresas WHERE excluido_em IS NULL ORDER BY nome_social");
        $rows = $stmt->fetchAll();
        $result = array_map(function ($r) {
            $dados = json_decode($r['dados_json'], true);
            $dados['_meta'] = ['atualizado_em' => $r['atualizado_em']];
            return $dados;
        }, $rows);
    }

    elseif ($action === 'obter_empresa') {
        $id = $_GET['id'] ?? '';
        if (!$id) throw new \Exception('ID não informado', 400);
        $stmt = $db->prepare("SELECT dados_json, atualizado_em FROM empresas WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) throw new \Exception('Empresa não encontrada', 404);
        $dados = json_decode($row['dados_json'], true);
        $dados['_meta'] = ['atualizado_em' => $row['atualizado_em']];

        // Gatilhos
        $stmt2 = $db->prepare("SELECT data, motivo, descricao FROM gatilhos WHERE empresa_id = ? ORDER BY id ASC");
        $stmt2->execute([$id]);
        $dados['gatilhos'] = $stmt2->fetchAll();

        // Checklist
        $stmt3 = $db->prepare("SELECT sugestao_raw, criterios_raw, sugestoes_json, criterios_json FROM checklist WHERE empresa_id = ?");
        $stmt3->execute([$id]);
        $chk = $stmt3->fetch();
        if ($chk) {
            $dados['checklist'] = [
                'sugestao_raw'  => $chk['sugestao_raw'],
                'criterios_raw' => $chk['criterios_raw'],
                'sugestoes'     => json_decode($chk['sugestoes_json'], true),
                'criterios'     => json_decode($chk['criterios_json'], true),
            ];
        }

        // Incidências
        $stmt4 = $db->prepare("SELECT id, data, tipo, descricao, checked FROM incidencias WHERE empresa_id = ? ORDER BY id DESC");
        $stmt4->execute([$id]);
        $incs = $stmt4->fetchAll();
        $dados['incidencias'] = array_map(function ($i) {
            $i['checked'] = (bool)$i['checked'];
            return $i;
        }, $incs);

        $result = $dados;
    }

    elseif ($action === 'salvar_empresa' && $method === 'POST') {
        $dados = $body;
        $cnpj = $dados['empresa']['cnpj_matriz'] ?? '';
        $nome = $dados['empresa']['nome_social'] ?? ($dados['empresa']['razao_social_matriz'] ?? 'Sem nome');

        // Usa CNPJ como ID (sem pontuação), ou timestamp se vazio
        $id = preg_replace('/\D/', '', $cnpj) ?: (string)time();

        // Preserva metadados que vêm separados
        unset($dados['gatilhos'], $dados['checklist'], $dados['incidencias'], $dados['_meta']);

        $json = json_encode($dados, JSON_UNESCAPED_UNICODE);

        $stmt = $db->prepare("
            INSERT INTO empresas (id, nome_social, cnpj_matriz, dados_json, atualizado_em)
            VALUES (:id, :nome, :cnpj, :json, NOW())
            ON DUPLICATE KEY UPDATE
                nome_social   = VALUES(nome_social),
                cnpj_matriz   = VALUES(cnpj_matriz),
                dados_json    = VALUES(dados_json),
                atualizado_em = NOW()
        ");
        $stmt->execute([':id' => $id, ':nome' => $nome, ':cnpj' => $cnpj, ':json' => $json]);

        $result = ['ok' => true, 'id' => $id];
    }

    elseif ($action === 'excluir_empresa') {
        $id = $_GET['id'] ?? '';
        if (!$id) throw new \Exception('ID não informado', 400);
        // Soft Delete: marca excluido_em em vez de apagar fisicamente
        $stmt = $db->prepare("UPDATE empresas SET excluido_em = NOW() WHERE id = ?");
        $stmt->execute([$id]);
        $result = ['ok' => true];
    }

    elseif ($action === 'restaurar_empresa') {
        $id = $_GET['id'] ?? '';
        if (!$id) throw new \Exception('ID não informado', 400);
        // Restaura empresa excluída logicamente
        $stmt = $db->prepare("UPDATE empresas SET excluido_em = NULL WHERE id = ?");
        $stmt->execute([$id]);
        $result = ['ok' => true];
    }

    // ============================================================
    // GATILHOS
    // ============================================================
    elseif ($action === 'listar_gatilhos') {
        $empresa_id = $_GET['empresa_id'] ?? '';
        if (!$empresa_id) throw new \Exception('empresa_id não informado', 400);
        $stmt = $db->prepare("SELECT id, data, motivo, descricao, criado_em FROM gatilhos WHERE empresa_id = ? ORDER BY id ASC");
        $stmt->execute([$empresa_id]);
        $result = $stmt->fetchAll();
    }

    elseif ($action === 'salvar_gatilho' && $method === 'POST') {
        $empresa_id = $body['empresa_id'] ?? '';
        $data       = $body['data'] ?? '';
        $motivo     = $body['motivo'] ?? '';
        $descricao  = $body['descricao'] ?? '';
        if (!$empresa_id || !$motivo || !$descricao) {
            throw new \Exception('Campos obrigatórios: empresa_id, motivo, descricao', 400);
        }
        $stmt = $db->prepare("INSERT INTO gatilhos (empresa_id, data, motivo, descricao) VALUES (?,?,?,?)");
        $stmt->execute([$empresa_id, $data, $motivo, $descricao]);
        $result = ['ok' => true, 'id' => $db->lastInsertId()];
    }

    // ============================================================
    // CHECKLIST
    // ============================================================
    elseif ($action === 'obter_checklist') {
        $empresa_id = $_GET['empresa_id'] ?? '';
        if (!$empresa_id) throw new \Exception('empresa_id não informado', 400);
        $stmt = $db->prepare("SELECT sugestao_raw, criterios_raw, sugestoes_json, criterios_json FROM checklist WHERE empresa_id = ?");
        $stmt->execute([$empresa_id]);
        $row = $stmt->fetch();
        if ($row) {
            $result = [
                'sugestao_raw'  => $row['sugestao_raw'],
                'criterios_raw' => $row['criterios_raw'],
                'sugestoes'     => json_decode($row['sugestoes_json'], true),
                'criterios'     => json_decode($row['criterios_json'], true),
            ];
        } else {
            $result = null;
        }
    }

    elseif ($action === 'salvar_checklist' && $method === 'POST') {
        $empresa_id    = $body['empresa_id'] ?? '';
        $sug_raw       = $body['sugestao_raw'] ?? '';
        $crit_raw      = $body['criterios_raw'] ?? '';
        $sugestoes     = $body['sugestoes'] ?? [];
        $criterios     = $body['criterios'] ?? [];
        if (!$empresa_id) throw new \Exception('empresa_id não informado', 400);

        $sug_json  = json_encode($sugestoes, JSON_UNESCAPED_UNICODE);
        $crit_json = json_encode($criterios, JSON_UNESCAPED_UNICODE);

        $stmt = $db->prepare("
            INSERT INTO checklist (empresa_id, sugestao_raw, criterios_raw, sugestoes_json, criterios_json, atualizado_em)
            VALUES (:eid, :sr, :cr, :sj, :cj, NOW())
            ON DUPLICATE KEY UPDATE
                sugestao_raw   = VALUES(sugestao_raw),
                criterios_raw  = VALUES(criterios_raw),
                sugestoes_json = VALUES(sugestoes_json),
                criterios_json = VALUES(criterios_json),
                atualizado_em  = NOW()
        ");
        $stmt->execute([':eid' => $empresa_id, ':sr' => $sug_raw, ':cr' => $crit_raw, ':sj' => $sug_json, ':cj' => $crit_json]);
        $result = ['ok' => true];
    }

    // ============================================================
    // INCIDÊNCIAS
    // ============================================================
    elseif ($action === 'listar_incidencias') {
        $empresa_id = $_GET['empresa_id'] ?? '';
        if (!$empresa_id) throw new \Exception('empresa_id não informado', 400);
        $stmt = $db->prepare("SELECT id, data, tipo, descricao, checked FROM incidencias WHERE empresa_id = ? ORDER BY id DESC");
        $stmt->execute([$empresa_id]);
        $rows = $stmt->fetchAll();
        $result = array_map(function ($r) { $r['checked'] = (bool)$r['checked']; return $r; }, $rows);
    }

    elseif ($action === 'salvar_incidencia' && $method === 'POST') {
        $empresa_id = $body['empresa_id'] ?? '';
        $data       = $body['data'] ?? '';
        $tipo       = $body['tipo'] ?? '';
        $descricao  = $body['descricao'] ?? '';
        if (!$empresa_id || !$descricao) throw new \Exception('Campos obrigatórios: empresa_id, descricao', 400);
        $stmt = $db->prepare("INSERT INTO incidencias (empresa_id, data, tipo, descricao) VALUES (?,?,?,?)");
        $stmt->execute([$empresa_id, $data, $tipo, $descricao]);
        $result = ['ok' => true, 'id' => $db->lastInsertId()];
    }

    elseif ($action === 'toggle_incidencia' && $method === 'POST') {
        $id      = $body['id'] ?? 0;
        $checked = $body['checked'] ? 1 : 0;
        $stmt = $db->prepare("UPDATE incidencias SET checked = ? WHERE id = ?");
        $stmt->execute([$checked, $id]);
        $result = ['ok' => true];
    }

    elseif ($action === 'excluir_incidencia') {
        $id = $_GET['id'] ?? 0;
        $stmt = $db->prepare("DELETE FROM incidencias WHERE id = ?");
        $stmt->execute([$id]);
        $result = ['ok' => true];
    }

    elseif ($action === 'limpar_incidencias') {
        $empresa_id = $_GET['empresa_id'] ?? '';
        if (!$empresa_id) throw new \Exception('empresa_id não informado', 400);
        $stmt = $db->prepare("DELETE FROM incidencias WHERE empresa_id = ?");
        $stmt->execute([$empresa_id]);
        $result = ['ok' => true];
    }

    elseif ($action === 'limpar_checklist' && $method === 'POST') {
        $empresa_id = $body['empresa_id'] ?? '';
        if (!$empresa_id) throw new \Exception('empresa_id não informado', 400);
        $stmt = $db->prepare("
            UPDATE checklist SET
                sugestoes_json = '[]', criterios_json = '[]',
                sugestao_raw = '', criterios_raw = ''
            WHERE empresa_id = ?
        ");
        $stmt->execute([$empresa_id]);
        $result = ['ok' => true];
    }

    // ============================================================
    // USUÁRIOS
    // ============================================================
    elseif ($action === 'listar_usuarios') {
        $stmt = $db->query("SELECT id, name, email, role, active, criado_em FROM users ORDER BY name");
        $result = array_map(function ($u) { $u['active'] = (bool)$u['active']; return $u; }, $stmt->fetchAll());
    }

    elseif ($action === 'criar_usuario' && $method === 'POST') {
        $name  = trim($body['name']  ?? '');
        $email = trim($body['email'] ?? '');
        $role  = $body['role'] ?? 'analista';
        if (!$name || !$email) throw new \Exception('name e email são obrigatórios', 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new \Exception('E-mail inválido', 400);
        $hash = password_hash('Bern@2026', PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)");
        $stmt->execute([$name, $email, $hash, $role]);
        $result = ['ok' => true, 'id' => $db->lastInsertId()];
    }

    elseif ($action === 'atualizar_usuario' && $method === 'POST') {
        $id    = $body['id']    ?? 0;
        $name  = trim($body['name']  ?? '');
        $email = trim($body['email'] ?? '');
        $role  = $body['role'] ?? null;
        if (!$id) throw new \Exception('id é obrigatório', 400);
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new \Exception('E-mail inválido', 400);
        $sets = []; $params = [];
        if ($name)  { $sets[] = 'name = ?';  $params[] = $name; }
        if ($email) { $sets[] = 'email = ?'; $params[] = $email; }
        if ($role)  { $sets[] = 'role = ?';  $params[] = $role; }
        if (!$sets) throw new \Exception('Nenhum campo para atualizar', 400);
        $params[] = $id;
        $db->prepare("UPDATE users SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);
        $result = ['ok' => true];
    }

    elseif ($action === 'excluir_usuario') {
        $id = $_GET['id'] ?? 0;
        if (!$id) throw new \Exception('id é obrigatório', 400);
        $db->prepare("UPDATE users SET active = 0 WHERE id = ?")->execute([$id]);
        $result = ['ok' => true];
    }

    elseif ($action === 'resetar_senha' && $method === 'POST') {
        $id = $body['id'] ?? 0;
        if (!$id) throw new \Exception('id é obrigatório', 400);
        $hash = password_hash('Bern@2026', PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$hash, $id]);
        $result = ['ok' => true];
    }

    // ============================================================
    // AUTENTICAÇÃO
    // ============================================================
    elseif ($action === 'login' && $method === 'POST') {
        $email = trim($body['email'] ?? '');
        $pass  = $body['password'] ?? '';
        if (!$email || !$pass) throw new \Exception('E-mail e senha são obrigatórios', 400);
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($pass, $user['password_hash'])) {
            throw new \Exception('Credenciais inválidas', 401);
        }
        if (session_status() === PHP_SESSION_NONE) session_start();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        unset($user['password_hash']);
        $user['active'] = (bool)$user['active'];
        $result = $user;
    }

    elseif ($action === 'logout' && $method === 'POST') {
        if (session_status() === PHP_SESSION_NONE) session_start();
        session_destroy();
        $result = ['ok' => true];
    }

    elseif ($action === 'me') {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION['user_id'])) throw new \Exception('Não autenticado', 401);
        $stmt = $db->prepare("SELECT id, name, email, role, active FROM users WHERE id = ? AND active = 1");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if (!$user) throw new \Exception('Sessão inválida', 401);
        $user['active'] = (bool)$user['active'];
        $result = $user;
    }

    elseif ($action === 'alterar_senha' && $method === 'POST') {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION['user_id'])) throw new \Exception('Não autenticado', 401);
        $stmt = $db->prepare("SELECT password_hash FROM users WHERE id = ? AND active = 1");
        $stmt->execute([$_SESSION['user_id']]);
        $row = $stmt->fetch();
        if (!$row) throw new \Exception('Sessão inválida', 401);
        $cur = $body['senha_atual']  ?? '';
        $new = $body['nova_senha']   ?? '';
        if (strlen($new) < 6) throw new \Exception('A nova senha deve ter ao menos 6 caracteres', 400);
        if (!password_verify($cur, $row['password_hash'])) throw new \Exception('Senha atual incorreta', 400);
        $hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$hash, $_SESSION['user_id']]);
        $result = ['ok' => true];
    }

    else {
        throw new \Exception("Ação não reconhecida: $action", 404);
    }

    echo json_encode(['success' => true, 'data' => $result], JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    $code = (int)$e->getCode();
    if ($code < 100 || $code > 599) $code = 500;
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
}
