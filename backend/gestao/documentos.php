<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/api.php';
require_once __DIR__ . '/../lib/gestao.php';

// Gestão de Documentos (DER: documentos) — notas fiscais, receitas agronômicas, contratos,
// laudos de solo. Pastas: Fazenda > Talhão > Safra. url_arquivo guarda o nome do arquivo em
// uploads/documentos/ (acesso direto bloqueado; download por documento_baixar.php).
//   GET [?fazenda_id&talhao_id&safra_id&tipo&busca] -> documentos + árvore de pastas
//   POST multipart acao=enviar: arquivo, titulo, tipo, fazenda_id, talhao_id?, safra_id?, data_validade?
//   POST acao=excluir&id=N
const TIPOS_DOCUMENTO = [
    'nota_fiscal'        => 'Nota fiscal',
    'receita_agronomica' => 'Receita agronômica',
    'contrato'           => 'Contrato',
    'laudo_solo'         => 'Laudo de análise de solo',
    'licenca'            => 'Licença / autorização',
    'outro'              => 'Outro',
];
const MIMES_DOCUMENTO = [
    'application/pdf' => 'pdf',
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
    'application/vnd.ms-excel' => 'xls',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    'application/msword' => 'doc',
    'text/plain' => 'txt',
    'text/csv' => 'csv',
    'application/zip' => 'zip', // alguns servidores identificam .xlsx/.docx como zip
];
const TAMANHO_MAX_DOCUMENTO = 10 * 1024 * 1024;

try {
    [$pdo, $usuarioId] = inicio_gestao('documentos');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $where = ['f.usuario_id = :usuario'];
        $params = [':usuario' => $usuarioId];
        foreach (['fazenda_id', 'talhao_id', 'safra_id'] as $campo) {
            $valor = filter_var($_GET[$campo] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($valor) {
                $where[] = "d.$campo = :$campo";
                $params[":$campo"] = $valor;
            }
        }
        if (isset(TIPOS_DOCUMENTO[$_GET['tipo'] ?? ''])) {
            $where[] = 'd.tipo_documento = :tipo';
            $params[':tipo'] = $_GET['tipo'];
        }
        $busca = trim((string) ($_GET['busca'] ?? ''));
        if ($busca !== '') {
            $where[] = '(d.titulo LIKE :busca OR d.nome_original LIKE :busca2)';
            $params[':busca'] = $params[':busca2'] = '%' . $busca . '%';
        }

        $stmt = $pdo->prepare(
            "SELECT d.id, d.fazenda_id, f.nome AS fazenda_nome, d.talhao_id, t.nome_identificacao AS talhao_nome, d.safra_id,
                    s.ano_periodo AS safra_nome, d.tipo_documento AS tipo, COALESCE(NULLIF(d.titulo, ''), d.tipo_documento) AS titulo,
                    COALESCE(d.nome_original, d.url_arquivo) AS nome_original, COALESCE(d.mime, '') AS mime,
                    COALESCE(d.tamanho, 0) AS tamanho, d.data_validade, d.data_upload AS data_criacao,
                    DATEDIFF(d.data_validade, CURDATE()) AS dias_validade
               FROM documentos d
               JOIN fazendas f ON f.id = d.fazenda_id
               LEFT JOIN talhoes t ON t.id = d.talhao_id
               LEFT JOIN safras s ON s.id = d.safra_id
              WHERE " . implode(' AND ', $where) . '
              ORDER BY d.data_upload DESC, d.id DESC'
        );
        $stmt->execute($params);
        $documentos = $stmt->fetchAll();

        // Árvore de pastas (todas as do usuário, sem filtro).
        $stmt = $pdo->prepare(
            "SELECT f.nome AS fazenda, d.fazenda_id,
                    COALESCE(t.nome_identificacao, 'Geral da propriedade') AS talhao, d.talhao_id,
                    COALESCE(s.ano_periodo, 'Sem safra') AS safra, d.safra_id, COUNT(*) AS total
               FROM documentos d
               JOIN fazendas f ON f.id = d.fazenda_id
               LEFT JOIN talhoes t ON t.id = d.talhao_id
               LEFT JOIN safras s ON s.id = d.safra_id
              WHERE f.usuario_id = :usuario
              GROUP BY fazenda, d.fazenda_id, talhao, d.talhao_id, safra, d.safra_id
              ORDER BY fazenda, talhao, safra"
        );
        $stmt->execute([':usuario' => $usuarioId]);

        responder(200, ['sucesso' => true, 'documentos' => $documentos, 'pastas' => $stmt->fetchAll(), 'tipos' => TIPOS_DOCUMENTO]);
    }

    exigir_metodo('POST');
    $d = entrada();
    $acao = (string) ($d['acao'] ?? '');

    if ($acao === 'excluir') {
        $id = inteiro_id($d, 'id', true);
        $stmt = $pdo->prepare('SELECT d.url_arquivo FROM documentos d JOIN fazendas f ON f.id = d.fazenda_id WHERE d.id = :id AND f.usuario_id = :usuario');
        $stmt->execute([':id' => $id, ':usuario' => $usuarioId]);
        $arquivo = $stmt->fetchColumn();
        if ($arquivo === false) {
            falha('Documento não encontrado.', 404);
        }
        $pdo->prepare('DELETE FROM documentos WHERE id = :id')->execute([':id' => $id]);
        if (preg_match('/^[a-f0-9]{32}\.[a-z]{2,4}$/', (string) $arquivo) === 1) {
            @unlink(dirname(__DIR__, 2) . '/uploads/documentos/' . $arquivo);
        }
        responder(200, ['sucesso' => true, 'mensagem' => 'Documento excluído.']);
    }

    if ($acao !== 'enviar') {
        falha('Ação inválida.');
    }

    $arquivo = $_FILES['arquivo'] ?? null;
    if (!$arquivo || $arquivo['error'] === UPLOAD_ERR_NO_FILE) {
        falha('Escolha o arquivo do documento.');
    }
    if ($arquivo['error'] === UPLOAD_ERR_INI_SIZE || $arquivo['error'] === UPLOAD_ERR_FORM_SIZE || $arquivo['size'] > TAMANHO_MAX_DOCUMENTO) {
        falha('O arquivo pode ter no máximo 10 MB.');
    }
    if ($arquivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($arquivo['tmp_name'])) {
        falha('Não foi possível receber o arquivo. Tente novamente.');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($arquivo['tmp_name']);
    if (!isset(MIMES_DOCUMENTO[$mime])) {
        falha('Formato não aceito. Envie PDF, imagem (JPG/PNG/WEBP), planilha, documento do Word ou texto.');
    }
    $extensao = MIMES_DOCUMENTO[$mime];
    $original = mb_substr(basename(str_replace('\\', '/', (string) $arquivo['name'])), 0, 255);
    if ($mime === 'application/zip') {
        $extOriginal = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if (!in_array($extOriginal, ['xlsx', 'docx'], true)) {
            falha('Arquivos compactados não são aceitos.');
        }
        $extensao = $extOriginal;
    }

    // No DER todo documento pertence a uma propriedade; talhão e safra são subpastas dela.
    $fazendaId = inteiro_id($d, 'fazenda_id');
    $talhaoId = inteiro_id($d, 'talhao_id');
    $safraId = inteiro_id($d, 'safra_id');
    if ($talhaoId) {
        $fazendaDoTalhao = (int) exigir_talhao($pdo, $usuarioId, $talhaoId)['fazenda_id'];
        if ($fazendaId && $fazendaId !== $fazendaDoTalhao) {
            falha('O talhão não pertence a esta propriedade.');
        }
        $fazendaId = $fazendaDoTalhao;
    }
    if ($safraId) {
        $fazendaDaSafra = (int) exigir_safra($pdo, $usuarioId, $safraId)['fazenda_id'];
        if ($fazendaId && $fazendaId !== $fazendaDaSafra) {
            falha('A safra não pertence a esta propriedade.');
        }
        $fazendaId = $fazendaDaSafra;
    }
    if (!$fazendaId) {
        falha('Escolha a propriedade (pasta) do documento.');
    }
    exigir_fazenda($pdo, $usuarioId, $fazendaId);

    $titulo = texto($d, 'titulo', 150) ?? mb_substr(pathinfo($original, PATHINFO_FILENAME), 0, 150);
    $tipo = opcao($d, 'tipo', array_keys(TIPOS_DOCUMENTO), 'outro', 'tipo');
    $validade = data_valida($d, 'data_validade', false, 'validade');

    $pasta = dirname(__DIR__, 2) . '/uploads/documentos/';
    if (!is_dir($pasta) && !mkdir($pasta, 0755, true)) {
        throw new RuntimeException('Pasta de documentos indisponível.');
    }
    $nomeArquivo = bin2hex(random_bytes(16)) . '.' . $extensao;
    if (!move_uploaded_file($arquivo['tmp_name'], $pasta . $nomeArquivo)) {
        throw new RuntimeException('Falha ao mover o documento.');
    }

    try {
        $pdo->prepare(
            'INSERT INTO documentos (fazenda_id, talhao_id, safra_id, tipo_documento, url_arquivo, titulo, nome_original, mime, tamanho, data_validade)
             VALUES (:fazenda, :talhao, :safra, :tipo, :arquivo, :titulo, :original, :mime, :tamanho, :validade)'
        )->execute([
            ':fazenda' => $fazendaId, ':talhao' => $talhaoId, ':safra' => $safraId, ':tipo' => $tipo,
            ':arquivo' => $nomeArquivo, ':titulo' => $titulo ?: 'Documento', ':original' => $original ?: $nomeArquivo,
            ':mime' => $mime, ':tamanho' => (int) $arquivo['size'], ':validade' => $validade,
        ]);
    } catch (Throwable $e) {
        @unlink($pasta . $nomeArquivo);
        throw $e;
    }

    responder(201, ['sucesso' => true, 'mensagem' => 'Documento enviado.', 'id' => (int) $pdo->lastInsertId()]);
} catch (Throwable $erro) {
    error_log('[MARKETPLACE_GESTAO_DOCUMENTOS] ' . $erro->getMessage());
    responder(500, ['sucesso' => false, 'mensagem' => 'Não foi possível processar o documento.']);
}
