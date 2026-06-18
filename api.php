<?php
/**
 * api.php
 * API REST em PHP puro com MariaDB.
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

$body = [];
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}

try {
    $db = getDB();
    $result = null;

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
        $stmt = $db->prepare("SELECT dados_json, atualizado_em FROM empresas WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) throw new \Exception('Empresa não encontrada', 404);
        $dados = json_decode($row['dados_json'], true);
        $dados['_meta'] = ['atualizado_em' => $row['atualizado_em']];
        $stmt2 = $db->prepare("SELECT data, motivo, descricao FROM gatilhos WHERE empresa_id = ? ORDER BY id ASC");
        $stmt2->execute([$id]);
        $dados['gatilhos'] = $stmt2->fetchAll();
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
        $stmt4 = $db->prepare("SELECT id, data, tipo, descricao, checked FROM incidencias WHERE empresa_id = ? ORDER BY id DESC");
        $stmt4->execute([$id]);
        $incs = $stmt4->fetchAll();
        $dados['incidencias'] = array_map(function ($i) { $i['checked'] = (bool)$i['checked']; return $i; }, $incs);
        $result = $dados;
    }
    elseif ($action === 'salvar_empresa' && $method === 'POST') {
        $dados = $body;
        $cnpj = $dados['empresa']['cnpj_matriz'] ?? '';
        $nome = $dados['empresa']['nome_social'] ?? ($dados['empresa']['razao_social_matriz'] ?? 'Sem nome');
        $id = preg_replace('/\D/', '', $cnpj) ?: (string)time();
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
        // Soft Delete: marca excluido_em em vez de apagar fisicamente
        $stmt = $db->prepare("UPDATE empresas SET excluido_em = NOW() WHERE id = ?");
        $stmt->execute([$id]);
        $result = ['ok' => true];
    }
    elseif ($action === 'restaurar_empresa') {
        $id = $_GET['id'] ?? '';
        // Restaura empresa excluída logicamente
        $stmt = $db->prepare("UPDATE empresas SET excluido_em = NULL WHERE id = ?");
        $stmt->execute([$id]);
        $result = ['ok' => true];
    }
    elseif ($action === 'salvar_gatilho' && $method === 'POST') {
        $stmt = $db->prepare("INSERT INTO gatilhos (empresa_id, data, motivo, descricao) VALUES (?,?,?,?)");
        $stmt->execute([$body['empresa_id'], $body['data'], $body['motivo'], $body['descricao']]);
        $result = ['ok' => true];
    }
    elseif ($action === 'obter_checklist') {
        $stmt = $db->prepare("SELECT sugestao_raw, criterios_raw, sugestoes_json, criterios_json FROM checklist WHERE empresa_id = ?");
        $stmt->execute([$_GET['empresa_id']]);
        $row = $stmt->fetch();
        $result = $row ? [
            'sugestao_raw'  => $row['sugestao_raw'],
            'criterios_raw' => $row['criterios_raw'],
            'sugestoes'     => json_decode($row['sugestoes_json'], true),
            'criterios'     => json_decode($row['criterios_json'], true),
        ] : null;
    }
    elseif ($action === 'salvar_checklist' && $method === 'POST') {
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
        $stmt->execute([
            ':eid' => $body['empresa_id'], ':sr' => $body['sugestao_raw'], ':cr' => $body['criterios_raw'],
            ':sj' => json_encode($body['sugestoes'], JSON_UNESCAPED_UNICODE),
            ':cj' => json_encode($body['criterios'], JSON_UNESCAPED_UNICODE)
        ]);
        $result = ['ok' => true];
    }
    elseif ($action === 'listar_incidencias') {
        $stmt = $db->prepare("SELECT id, data, tipo, descricao, checked FROM incidencias WHERE empresa_id = ? ORDER BY id DESC");
        $stmt->execute([$_GET['empresa_id']]);
        $result = array_map(function ($r) { $r['checked'] = (bool)$r['checked']; return $r; }, $stmt->fetchAll());
    }
    elseif ($action === 'salvar_incidencia' && $method === 'POST') {
        $data_formatada = $body['data'];
        // Se a data vier no formato DD/MM/YYYY, converte para YYYY-MM-DD para o banco de dados
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $data_formatada, $matches)) {
            $data_formatada = $matches[3] . '-' . $matches[2] . '-' . $matches[1];
        }
        $stmt = $db->prepare("INSERT INTO incidencias (empresa_id, data, tipo, descricao) VALUES (?,?,?,?)");
        $stmt->execute([$body['empresa_id'], $data_formatada, $body['tipo'], $body['descricao']]);
        $result = ['ok' => true];
    }
    elseif ($action === 'toggle_incidencia' && $method === 'POST') {
        $stmt = $db->prepare("UPDATE incidencias SET checked = ? WHERE id = ?");
        $stmt->execute([$body['checked'] ? 1 : 0, $body['id']]);
        $result = ['ok' => true];
    }
    elseif ($action === 'excluir_incidencia') {
        $stmt = $db->prepare("DELETE FROM incidencias WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        $result = ['ok' => true];
    }
    elseif ($action === 'limpar_incidencias') {
        $stmt = $db->prepare("DELETE FROM incidencias WHERE empresa_id = ?");
        $stmt->execute([$_GET['empresa_id']]);
        $result = ['ok' => true];
    }
    elseif ($action === 'limpar_checklist' && $method === 'POST') {
        $stmt = $db->prepare("UPDATE checklist SET sugestoes_json = '[]', criterios_json = '[]', sugestao_raw = '', criterios_raw = '' WHERE empresa_id = ?");
        $stmt->execute([$body['empresa_id']]);
        $result = ['ok' => true];
    }
    elseif ($action === 'salvar_anexo' && $method === 'POST') {
        // Recebe: base64_data, mime_type, empresa_id (opcional), origem, origem_id
        $base64  = $body['base64_data'] ?? '';
        $mime    = $body['mime_type']   ?? 'image/png';
        $empId   = $body['empresa_id']  ?? null;
        $origem  = $body['origem']      ?? null;
        $origemId= $body['origem_id']   ?? null;

        if (!$base64) throw new \Exception('Nenhuma imagem recebida.', 400);

        // Determina extensão
        $ext = 'png';
        if (strpos($mime, 'jpeg') !== false || strpos($mime, 'jpg') !== false) $ext = 'jpg';
        elseif (strpos($mime, 'gif') !== false) $ext = 'gif';
        elseif (strpos($mime, 'webp') !== false) $ext = 'webp';

        // Gera nome único
        $nomeArquivo = bin2hex(random_bytes(16)) . '.' . $ext;

        // Garante que a pasta existe
        $dir = __DIR__ . '/anexos';
        if (!is_dir($dir)) mkdir($dir, 0775, true);

        // Decodifica e salva
        $dadosImagem = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64));
        if ($dadosImagem === false) throw new \Exception('Falha ao decodificar imagem.', 400);
        file_put_contents($dir . '/' . $nomeArquivo, $dadosImagem);

        // URL relativa acessível pelo browser
        $url = 'anexos/' . $nomeArquivo;

        // Insere no banco
        $stmt = $db->prepare("INSERT INTO anexos (empresa_id, origem, origem_id, nome_arquivo, url) VALUES (?,?,?,?,?)");
        $stmt->execute([$empId, $origem, $origemId, $nomeArquivo, $url]);

        $result = ['ok' => true, 'url' => $url, 'id' => $db->lastInsertId()];
    }
    elseif ($action === 'listar_anexos') {
        $origem   = $_GET['origem']    ?? null;
        $origemId = $_GET['origem_id'] ?? null;
        $empId    = $_GET['empresa_id'] ?? null;

        if ($origem && $origemId) {
            $stmt = $db->prepare("SELECT id, empresa_id, origem, origem_id, nome_arquivo, url, criado_em FROM anexos WHERE origem = ? AND origem_id = ? ORDER BY id ASC");
            $stmt->execute([$origem, $origemId]);
        } elseif ($empId) {
            $stmt = $db->prepare("SELECT id, empresa_id, origem, origem_id, nome_arquivo, url, criado_em FROM anexos WHERE empresa_id = ? ORDER BY id ASC");
            $stmt->execute([$empId]);
        } else {
            throw new \Exception('Parâmetro obrigatório ausente.', 400);
        }
        $result = $stmt->fetchAll();
    }
    else { throw new \Exception("Ação não reconhecida", 404); }

    echo json_encode(['success' => true, 'data' => $result], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
}
