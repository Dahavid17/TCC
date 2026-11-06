<?php
declare(strict_types=1);

// Regras compartilhadas do monitoramento IoT (ESP32) da Gestão da Fazenda.
// Requer backend/lib/api.php (responder).

// Sensores da estação ESP32. A chave é o campo do JSON enviado pela placa e o
// valor gravado em sensores_iot.tipo_sensor. A ordem é a de exibição no painel.
const SENSORES_ESTACAO = [
    'umidade_solo' => ['nome' => 'Umidade do solo',   'unidade' => '%',  'min' => 0,   'max' => 100],
    'temperatura'  => ['nome' => 'Temperatura do ar', 'unidade' => '°C', 'min' => -40, 'max' => 80],
    'umidade_ar'   => ['nome' => 'Umidade do ar',     'unidade' => '%',  'min' => 0,   'max' => 100],
    'luminosidade' => ['nome' => 'Luminosidade',      'unidade' => 'lx', 'min' => 0,   'max' => 200000],
];

// Ex.: ESP32-MR-88CDA7 (o mesmo código definido no sketch da placa).
const PADRAO_CODIGO_DISPOSITIVO = '/^[A-Z0-9][A-Z0-9-]{3,39}$/';

// Quantas leituras recentes de cada sensor vão para o gráfico do painel.
const IOT_LEITURAS_HISTORICO = 30;

// sensores_iot.codigo_esp32 é UNIQUE no banco (um código por sensor). Como uma placa
// tem vários sensores, cada um recebe "<código da placa>:<tipo>",
// ex.: ESP32-MR-88CDA7:temperatura.
function codigo_sensor(string $codigoPlaca, string $tipo): string
{
    return $codigoPlaca . ':' . $tipo;
}

// Código da placa a partir do código do sensor (sensores antigos, sem ":", ficam como estão).
function codigo_placa_do_sensor(string $codigoSensor): string
{
    return explode(':', $codigoSensor, 2)[0];
}

// Bloqueia quem não é produtor/administrador (a regra vale no backend, não só no menu).
function exigir_produtor(PDO $pdo, int $usuarioId): void
{
    $stmt = $pdo->prepare('SELECT tipo_acesso FROM usuarios WHERE id = :id');
    $stmt->execute([':id' => $usuarioId]);

    if (!in_array($stmt->fetchColumn(), ['produtor', 'admin'], true)) {
        responder(403, ['sucesso' => false, 'mensagem' => 'A Gestão da Fazenda é exclusiva para produtores.']);
    }
}

// Lê o corpo JSON da requisição (até 16 KB) ou responde 400.
function ler_corpo_json(): array
{
    $bruto = file_get_contents('php://input', false, null, 0, 16384);
    $dados = json_decode((string) $bruto, true);

    if (!is_array($dados)) {
        responder(400, ['sucesso' => false, 'mensagem' => 'Envie um JSON válido.']);
    }

    return $dados;
}

function normalizar_codigo_dispositivo(mixed $codigo): string
{
    return strtoupper(trim((string) $codigo));
}

// Token entregue ao produtor ao conectar a placa; no banco fica só o hash.
function gerar_token_dispositivo(): string
{
    return bin2hex(random_bytes(24));
}

function hash_token_dispositivo(string $token): string
{
    return hash('sha256', $token);
}
