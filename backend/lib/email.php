<?php
declare(strict_types=1);

// E-mails automáticos do MarketPlace Rural. Custo zero: usa o envio de e-mail da própria
// hospedagem (função mail() do PHP no cPanel), sem serviço pago e sem senha no código.
//
// Remetente: avisos@buzzcodex.com.br (conta criada no cPanel). Pode ser trocado em
// backend/config/config.local.php:  'email_remetente' => '...', 'email_ativo' => false (desliga).
//
// Regras:
//  - Respeita Configurações > Preferências > E-mails (preferência "emails" = "nao").
//  - O e-mail é enviado DEPOIS de a resposta ir para o navegador: o usuário não espera.
//  - Qualquer falha só vai para o log; nunca desfaz o pedido ou a mensagem.

const EMAIL_SITE = 'https://buzzcodex.com.br';
const EMAIL_REMETENTE_PADRAO = 'avisos@buzzcodex.com.br';
const EMAIL_NOME_REMETENTE = 'MarketPlace Rural';
const CODIGO_EMAIL_VALIDADE_MINUTOS = 15; // código de confirmação (backend/lib/verificacao_email.php)

function config_email(): array
{
    static $config = null;

    if ($config === null) {
        $arquivo = getenv('MARKETPLACE_CONFIG') ?: __DIR__ . '/../config/config.local.php';
        $dados = is_file($arquivo) ? require $arquivo : [];
        $dados = is_array($dados) ? $dados : [];

        $config = [
            'ativo'     => (bool) ($dados['email_ativo'] ?? true),
            'remetente' => (string) ($dados['email_remetente'] ?? EMAIL_REMETENTE_PADRAO),
        ];
    }

    return $config;
}

function usuario_quer_emails(PDO $pdo, int $usuarioId): bool
{
    try {
        $stmt = $pdo->prepare("SELECT valor FROM usuarios_preferencias WHERE usuario_id = :id AND chave = 'emails'");
        $stmt->execute([':id' => $usuarioId]);

        return $stmt->fetchColumn() !== 'nao';
    } catch (PDOException $semTabela) {
        return true;
    }
}

// Monta o e-mail em HTML (letras grandes, botão bem visível) e a versão só texto.
// Com $codigo: e-mail de confirmação, mostra o código bem grande no lugar do botão.
function montar_email(string $nome, string $titulo, string $mensagem, ?string $link, ?string $codigo = null): array
{
    $h = fn(string $t): string => htmlspecialchars($t, ENT_QUOTES, 'UTF-8');
    $url = $link ? EMAIL_SITE . '/frontend/pages/' . $link : EMAIL_SITE . '/frontend/pages/inicio.html';
    $validade = 'O código vale por ' . CODIGO_EMAIL_VALIDADE_MINUTOS . ' minutos. Se não foi você que pediu, é só ignorar este e-mail: nada muda na sua conta.';

    $acao = $codigo === null
        ? '<a href="' . $h($url) . '" style="display:inline-block;background:#31572c;color:#ffffff;text-decoration:none;font-size:18px;font-weight:bold;padding:16px 28px;border-radius:12px">Abrir no MarketPlace Rural</a>'
        : '<div style="display:inline-block;background:#f6faf2;border:2px solid #31572c;padding:14px 26px;font-family:Consolas,Menlo,monospace;font-size:36px;font-weight:bold;letter-spacing:10px;color:#31572c">' . $h($codigo) . '</div>';

    $rodape = $codigo === null
        ? 'Você recebeu este aviso porque tem uma conta no MarketPlace Rural. Para não receber mais e-mails, '
          . 'entre em <b>Configurações &rsaquo; Preferências</b> e desligue <b>E-mails</b>.<br>'
        : $h($validade) . '<br>';

    $html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>'
        . '<body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,Helvetica,sans-serif;color:#202820">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e6;padding:24px 12px"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">'
        . '<tr><td style="background:#31572c;padding:20px 28px;color:#ffffff;font-size:22px;font-weight:bold">&#127793; MarketPlace Rural</td></tr>'
        . '<tr><td style="padding:28px">'
        . '<p style="margin:0 0 8px;font-size:18px">Olá, ' . $h($nome) . '!</p>'
        . '<h1 style="margin:0 0 12px;font-size:24px;color:#31572c">' . $h($titulo) . '</h1>'
        . '<p style="margin:0 0 24px;font-size:18px;line-height:1.5">' . $h($mensagem) . '</p>'
        . $acao
        . '</td></tr>'
        . '<tr><td style="padding:18px 28px;background:#f6faf2;font-size:13px;line-height:1.5;color:#667064">'
        . $rodape
        . 'Projeto de TCC Buzz Codex &mdash; SESI/SENAI.</td></tr>'
        . '</table></td></tr></table></body></html>';

    $texto = $codigo === null
        ? "Olá, {$nome}!\n\n{$titulo}\n\n{$mensagem}\n\nAbrir no MarketPlace Rural: {$url}\n\n"
          . "Para não receber mais e-mails, entre em Configurações > Preferências e desligue E-mails.\n"
        : "Olá, {$nome}!\n\n{$titulo}\n\n{$mensagem}\n\nSEU CÓDIGO: {$codigo}\n\n{$validade}\n";

    return ['html' => $html, 'texto' => $texto];
}

// Envia de fato (multipart: texto + HTML). Devolve true se o servidor aceitou o e-mail.
function enviar_email_agora(string $para, string $nome, string $assunto, string $titulo, string $mensagem, ?string $link, ?string $codigo = null): bool
{
    $config = config_email();
    $corpo = montar_email($nome, $titulo, $mensagem, $link, $codigo);
    $fronteira = 'mr-' . bin2hex(random_bytes(8));
    $remetente = $config['remetente'];

    // Cabeçalhos completos e com o próprio domínio ajudam o Gmail/Outlook a não mandar para o Spam
    // (o servidor ainda assina com DKIM; SPF e DMARC ficam no DNS de buzzcodex.com.br).
    $dominio = substr(strrchr($remetente, '@'), 1) ?: 'buzzcodex.com.br';

    $cabecalhos = [
        'From: =?UTF-8?B?' . base64_encode(EMAIL_NOME_REMETENTE) . "?= <{$remetente}>",
        "Reply-To: {$remetente}",
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '.' . time() . "@{$dominio}>",
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"{$fronteira}\"",
        'Auto-Submitted: auto-generated',
    ];

    $mensagemMime = "--{$fronteira}\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($corpo['texto']))
        . "--{$fronteira}\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($corpo['html']))
        . "--{$fronteira}--\r\n";

    $assuntoCodificado = '=?UTF-8?B?' . base64_encode($assunto) . '?=';

    return mail($para, $assuntoCodificado, $mensagemMime, implode("\r\n", $cabecalhos), '-f' . $remetente);
}

// Código de confirmação: enviado na hora (a tela precisa saber se o servidor aceitou).
function enviar_email_codigo(string $para, string $nome, string $codigo): bool
{
    try {
        return enviar_email_agora(
            $para,
            $nome,
            "Seu código: {$codigo} — MarketPlace Rural",
            'Confirme seu e-mail',
            'Digite o código abaixo na tela do MarketPlace Rural para confirmar que este e-mail é seu.',
            null,
            $codigo
        );
    } catch (Throwable $erro) {
        error_log('[MARKETPLACE_EMAIL] ' . $erro->getMessage());

        return false;
    }
}

// Agenda o e-mail para depois da resposta (o usuário não espera o envio).
function enviar_email_aviso(PDO $pdo, int $usuarioId, string $titulo, string $mensagem, ?string $link): void
{
    try {
        if (!config_email()['ativo'] || !usuario_quer_emails($pdo, $usuarioId)) {
            return;
        }

        // Só e-mails confirmados com o código recebem avisos (ver backend/lib/verificacao_email.php).
        try {
            $stmt = $pdo->prepare('SELECT nome, email FROM usuarios WHERE id = :id AND email_verificado = 1');
            $stmt->execute([':id' => $usuarioId]);
        } catch (PDOException $semColuna) {
            return; // verificação ainda não existe no banco: ninguém confirmou ainda
        }

        $usuario = $stmt->fetch();

        // Contas excluídas ficam com e-mail @contas.invalid: nunca recebem nada.
        if (!$usuario || !filter_var($usuario['email'], FILTER_VALIDATE_EMAIL) || str_ends_with($usuario['email'], '.invalid')) {
            return;
        }

        $nome = explode(' ', trim((string) $usuario['nome']))[0] ?: 'produtor';
        $para = $usuario['email'];

        register_shutdown_function(function () use ($para, $nome, $titulo, $mensagem, $link) {
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request(); // entrega a resposta ao navegador antes de enviar
            }

            try {
                if (!enviar_email_agora($para, $nome, $titulo . ' — MarketPlace Rural', $titulo, $mensagem, $link)) {
                    error_log('[MARKETPLACE_EMAIL] O servidor recusou o envio para o usuário.');
                }
            } catch (Throwable $erro) {
                error_log('[MARKETPLACE_EMAIL] ' . $erro->getMessage());
            }
        });
    } catch (Throwable $erro) {
        error_log('[MARKETPLACE_EMAIL] ' . $erro->getMessage());
    }
}
