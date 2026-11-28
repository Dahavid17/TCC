<?php
declare(strict_types=1);

// Regras compartilhadas dos módulos de Gestão (talhões, safras, diário de campo, agenda,
// financeiro, documentos, silos e relatórios). Requer backend/lib/api.php.
//
// Tabelas do DER original (migração 009): talhoes, culturas_talhao, operacoes_diario,
// agenda_rural, transacoes_financeiras, documentos. Elas não têm usuario_id: o dono é
// sempre o da fazenda (fazendas.usuario_id).
//
// ISOLAMENTO ENTRE CONTAS (multi-tenancy): os endpoints recebem ids do navegador e NUNCA
// confiam neles. As funções exigir_* conferem, pela fazenda, se o registro pertence ao
// usuário da sessão antes de qualquer leitura ou gravação, e respondem 404 (não 403) para
// não revelar que o registro de outra conta existe.

require_once __DIR__ . '/iot.php'; // exigir_produtor, ler_corpo_json

// Reservas caso a versão do lib/iot.php no servidor não tenha alguma destas funções.
if (!function_exists('exigir_produtor')) {
    function exigir_produtor(PDO $pdo, int $usuarioId): void
    {
        $stmt = $pdo->prepare('SELECT tipo_acesso FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $usuarioId]);

        if (!in_array($stmt->fetchColumn(), ['produtor', 'admin'], true)) {
            responder(403, ['sucesso' => false, 'mensagem' => 'A Gestão da Fazenda é exclusiva para produtores.']);
        }
    }
}

// Corpo JSON da gestão: até 1 MB (o ler_corpo_json do IoT para em 16 KB, pouco para sincronizar
// muitos registros do diário feitos offline ou um talhão com muitos pontos no mapa).
function ler_json_gestao(): array
{
    $dados = json_decode((string) file_get_contents('php://input', false, null, 0, 1048576), true);

    if (!is_array($dados)) {
        responder(400, ['sucesso' => false, 'mensagem' => 'Envie um JSON válido.']);
    }

    return $dados;
}

const CULTURAS = [
    'soja', 'milho', 'cafe', 'feijao', 'trigo', 'arroz', 'cana', 'algodao', 'sorgo',
    'mandioca', 'laranja', 'banana', 'tomate', 'batata', 'hortalicas', 'pastagem', 'eucalipto', 'outra',
];

const NOMES_CULTURA = [
    'soja' => 'Soja', 'milho' => 'Milho', 'cafe' => 'Café', 'feijao' => 'Feijão', 'trigo' => 'Trigo',
    'arroz' => 'Arroz', 'cana' => 'Cana-de-açúcar', 'algodao' => 'Algodão', 'sorgo' => 'Sorgo',
    'mandioca' => 'Mandioca', 'laranja' => 'Laranja', 'banana' => 'Banana', 'tomate' => 'Tomate',
    'batata' => 'Batata', 'hortalicas' => 'Hortaliças', 'pastagem' => 'Pastagem',
    'eucalipto' => 'Eucalipto', 'outra' => 'Outra',
];

const TIPOS_OPERACAO = ['plantio', 'pulverizacao', 'adubacao', 'irrigacao', 'colheita', 'preparo_solo', 'outro'];

const CATEGORIAS_DESPESA = [
    'sementes'      => 'Sementes',
    'defensivos'    => 'Defensivos',
    'fertilizantes' => 'Fertilizantes',
    'combustivel'   => 'Combustível',
    'mao_de_obra'   => 'Mão de obra',
    'fretes'        => 'Fretes',
    'maquinas'      => 'Máquinas e manutenção',
    'energia'       => 'Energia e irrigação',
    'arrendamento'  => 'Arrendamento',
    'outros'        => 'Outras despesas',
];

const CATEGORIAS_RECEITA = [
    'venda_producao'    => 'Venda da produção',
    'venda_marketplace' => 'Vendas no marketplace',
    'subsidio'          => 'Subsídios e seguros',
    'outras_receitas'   => 'Outras receitas',
];

// Quilos por unidade de produção (para converter produtividade entre sacas e toneladas).
const KG_POR_UNIDADE = ['saca' => 60, 'tonelada' => 1000, 'kg' => 1, 'caixa' => 20, 'litro' => 1];

// Colunas do DER com os nomes que o frontend usa.
const SQL_TALHAO_COLUNAS = 't.id, t.fazenda_id, t.nome_identificacao AS nome, t.area_hectares AS area_ha';

// Corpo da requisição: JSON (application/json) ou formulário (multipart/urlencoded).
function entrada(): array
{
    $tipo = (string) ($_SERVER['CONTENT_TYPE'] ?? '');

    if (stripos($tipo, 'application/json') !== false) {
        return ler_json_gestao();
    }

    return $_POST;
}

function falha(string $mensagem, int $status = 422): never
{
    responder($status, ['sucesso' => false, 'mensagem' => $mensagem]);
}

function texto(array $d, string $campo, int $max, bool $obrigatorio = false, string $rotulo = ''): ?string
{
    $valor = trim((string) ($d[$campo] ?? ''));
    $rotulo = $rotulo ?: $campo;

    if ($valor === '') {
        if ($obrigatorio) {
            falha("Preencha o campo {$rotulo}.");
        }
        return null;
    }

    if (mb_strlen($valor) > $max) {
        falha("O campo {$rotulo} aceita no máximo {$max} caracteres.");
    }

    return $valor;
}

function decimal(array $d, string $campo, float $min = 0, float $max = 9999999999.99, bool $obrigatorio = false, string $rotulo = ''): ?float
{
    $bruto = $d[$campo] ?? '';
    $rotulo = $rotulo ?: $campo;

    if ($bruto === '' || $bruto === null) {
        if ($obrigatorio) {
            falha("Informe {$rotulo}.");
        }
        return null;
    }

    $valor = is_string($bruto) ? str_replace(',', '.', trim($bruto)) : $bruto;

    if (!is_numeric($valor) || (float) $valor < $min || (float) $valor > $max) {
        falha("Valor inválido para {$rotulo}.");
    }

    return round((float) $valor, 3);
}

function inteiro_id(array $d, string $campo, bool $obrigatorio = false): ?int
{
    $bruto = $d[$campo] ?? '';

    if ($bruto === '' || $bruto === null || $bruto === 0 || $bruto === '0') {
        if ($obrigatorio) {
            falha('Registro inválido.');
        }
        return null;
    }

    $id = filter_var($bruto, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

    if ($id === false) {
        falha('Registro inválido.');
    }

    return $id;
}

function data_valida(array $d, string $campo, bool $obrigatorio = false, string $rotulo = ''): ?string
{
    $valor = trim((string) ($d[$campo] ?? ''));
    $rotulo = $rotulo ?: $campo;

    if ($valor === '') {
        if ($obrigatorio) {
            falha("Informe a data ({$rotulo}).");
        }
        return null;
    }

    $data = DateTime::createFromFormat('!Y-m-d', $valor);

    if (!$data || $data->format('Y-m-d') !== $valor) {
        falha("Data inválida ({$rotulo}).");
    }

    return $valor;
}

function opcao(array $d, string $campo, array $permitidas, ?string $padrao = null, string $rotulo = ''): string
{
    $valor = (string) ($d[$campo] ?? '');

    if ($valor === '' && $padrao !== null) {
        return $padrao;
    }

    if (!in_array($valor, $permitidas, true)) {
        falha('Opção inválida para ' . ($rotulo ?: $campo) . '.');
    }

    return $valor;
}

// ── Posse dos registros (isolamento entre contas) ───────────────────────────

function exigir_fazenda(PDO $pdo, int $usuarioId, ?int $fazendaId): array
{
    $stmt = $pdo->prepare('SELECT id, nome, area_total FROM fazendas WHERE id = :id AND usuario_id = :usuario');
    $stmt->execute([':id' => (int) $fazendaId, ':usuario' => $usuarioId]);
    $fazenda = $stmt->fetch();

    if (!$fazenda) {
        falha('Propriedade não encontrada.', 404);
    }

    return $fazenda;
}

function exigir_talhao(PDO $pdo, int $usuarioId, ?int $talhaoId): array
{
    $stmt = $pdo->prepare(
        'SELECT ' . SQL_TALHAO_COLUNAS . '
           FROM talhoes t JOIN fazendas f ON f.id = t.fazenda_id
          WHERE t.id = :id AND f.usuario_id = :usuario'
    );
    $stmt->execute([':id' => (int) $talhaoId, ':usuario' => $usuarioId]);
    $talhao = $stmt->fetch();

    if (!$talhao) {
        falha('Talhão não encontrado.', 404);
    }

    return $talhao;
}

function exigir_safra(PDO $pdo, int $usuarioId, ?int $safraId): array
{
    $stmt = $pdo->prepare(
        'SELECT s.id, s.fazenda_id, s.ano_periodo, s.status
           FROM safras s JOIN fazendas f ON f.id = s.fazenda_id
          WHERE s.id = :id AND f.usuario_id = :usuario'
    );
    $stmt->execute([':id' => (int) $safraId, ':usuario' => $usuarioId]);
    $safra = $stmt->fetch();

    if (!$safra) {
        falha('Safra não encontrada.', 404);
    }

    return $safra;
}

// Filtro opcional ?fazenda_id= validado contra as fazendas do usuário.
function filtro_fazenda(PDO $pdo, int $usuarioId): ?int
{
    $id = filter_var($_GET['fazenda_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

    if ($id === false || $id === null) {
        return null;
    }

    exigir_fazenda($pdo, $usuarioId, $id);

    return $id;
}

// Executa um DELETE/UPDATE já filtrado pelo dono; se nada mudou, o registro não é do
// usuário (ou não existe) e a resposta é 404 — nunca um "sucesso" enganoso.
function alterar_do_dono(PDO $pdo, string $sql, array $params, string $naoEncontrado = 'Registro não encontrado.'): void
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        falha($naoEncontrado, 404);
    }
}

function marcadores(array $valores): string
{
    return implode(',', array_fill(0, count($valores), '?'));
}

// ── Planos da Gestão da Fazenda ─────────────────────────────────────────────
// O plano é a preferência "plano" do usuário (backend/usuarios/preferencias.php), escolhido
// em planos.html. Mesmo mapa em frontend/js/modulos.js (RECURSOS_PLANO) e na vitrine
// frontend/js/planos-catalogo.js.
//   gestao            propriedades/talhões, safras, diário de campo, agenda, financeiro
//   dashboard_gestao  dashboard da gestão
//   documentos        documentos da fazenda
//   silos             silos, bags e reservatórios (IoT)
//   relatorios        relatórios em PDF/Excel
// Administrador tem acesso a tudo.
const RECURSOS_POR_PLANO = [
    'essencial' => ['gestao'],
    'pro'       => ['gestao', 'dashboard_gestao', 'documentos', 'silos', 'relatorios'],
];

function plano_do_usuario(PDO $pdo, int $usuarioId): ?string
{
    $stmt = $pdo->prepare('SELECT tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);
    if ($stmt->fetchColumn() === 'admin') {
        return 'pro';
    }

    try {
        $stmt = $pdo->prepare("SELECT valor FROM usuarios_preferencias WHERE usuario_id = :id AND chave = 'plano'");
        $stmt->execute([':id' => $usuarioId]);
        $plano = $stmt->fetchColumn();
    } catch (PDOException $semTabela) {
        $plano = false;
    }

    return isset(RECURSOS_POR_PLANO[$plano]) ? $plano : null;
}

// Responde 403 (com o plano necessário) se o plano do usuário não libera o recurso.
function exigir_recurso(PDO $pdo, int $usuarioId, string $recurso): void
{
    $plano = plano_do_usuario($pdo, $usuarioId);

    if ($plano === null) {
        responder(403, ['sucesso' => false, 'plano_necessario' => 'essencial', 'sem_plano' => true,
            'mensagem' => 'Escolha um plano da Gestão da Fazenda para usar esta função.']);
    }

    if (!in_array($recurso, RECURSOS_POR_PLANO[$plano], true)) {
        responder(403, ['sucesso' => false, 'plano_necessario' => 'pro', 'plano_atual' => $plano,
            'mensagem' => 'Esta função faz parte do Plano Pro.']);
    }
}

// Sessão + conexão + produtor + plano que libera o recurso (padrão: gestão do dia a dia).
function inicio_gestao(string $recurso = 'gestao'): array
{
    $usuarioId = exigir_sessao();
    require __DIR__ . '/../config/conexao.php';
    exigir_produtor($pdo, $usuarioId);
    exigir_recurso($pdo, $usuarioId, $recurso);

    return [$pdo, $usuarioId];
}

function f2(mixed $v): float
{
    return round((float) $v, 2);
}
