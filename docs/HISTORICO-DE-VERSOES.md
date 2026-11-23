# Histórico de versões publicadas

Site: **https://buzzcodex.com.br** (HostGator, cPanel, pasta `public_html`)
Repositório: **github.com/Dahavid17/TCC**, ramo `main` (conta da escola; não usar a conta pessoal).

Cada publicação no site tem:
- um **commit** no GitHub (o código exato que foi para o ar);
- uma **etiqueta (tag)** `publicado-AAAA-MM-DD-assunto`, que marca o estado do site naquele momento;
- uma **pasta de backup** no servidor (`/home2/buzzcodexcom/backup-…`) com os arquivos *antigos* que foram substituídos.

Para voltar atrás, veja **COMO-PUBLICAR.md → "Voltar uma versão"**.

---

## Publicações (mais recente primeiro)

| Data | Tag | Commit | O que mudou | Backup no servidor |
|---|---|---|---|---|
| 23/11 | `publicado-2026-11-23-cache` | `9d3b431` | `.htaccess`: páginas, CSS e JS vão com "Cache-Control: no-cache" (ninguém fica com versão antiga depois de publicar, sem Ctrl+F5) | `backup-cache-2026-11-23` |
| 23/11 | `publicado-2026-11-23-perfil` | `1280e22` | Perfil: cidade vem preenchida (usa o endereço do cadastro), foto não some ao salvar, nome completo no Início e na aba Produtos | `backup-perfil-2026-11-23` |
| 23/11 | `publicado-2026-11-23-seo` | `661a409` | SEO: nome "Buzz Codex" no Google, `robots.txt`, `sitemap.xml` (publicado por outra sessão) | `backup-seo-2026-11-23` |
| 23/11 | `publicado-2026-11-23-chat` | `c97d162` | Chat mostra a foto de perfil; aviso "Opa! Esse produto é seu" com o mascote Broto | `backup-chat-2026-11-23` |
| 23/11 | `publicado-2026-11-23-inicio-spam` | `9df702c` (inclui `c9380dd`) | Foto de perfil no Início; seção "Produtos" abaixo dos destaques; aviso de Spam na tela do código; cabeçalhos do e-mail | `backup-inicio-spam-2026-11-23` |
| 22/11 | `publicado-2026-11-22-promocoes` | `f17b328` | Destaques, promoções (preço riscado) e aba "Produtos" | `backup-promocoes-2026-11-22` |
| 22/11 | `publicado-2026-11-22-verificacao` | `3684cdf` | Só e-mails reais: código de 6 números | `backup-verificacao-2026-11-22` |
| 22/11 | `publicado-2026-11-22-email` | `bd55f9f` (inclui `d5c2f07`, `5e15576`) | Configurações, modo escuro, notificações no sino, intro "Buzz Codex", favicons, e-mails automáticos | `backup-email-2026-11-22` |
| 12/11 | — | `a36a651` | Planos da Gestão da Fazenda, tour no primeiro acesso | `backup-planos-2026-11-12` |
| 06/11 | — | `f0acb99` e anteriores | Fazenda 3D, sensores ESP32, chat de negociações | `backup-3d-…`, `backup-iot-…`, `backup-negociacoes-…` |
| 04/11 | — | `7804891` (registrado só em 23/11) | Página Marketplace: seção "Como funciona" (passos + vídeo) | `backup-onboarding-2026-11-04` |

### Commits só de registro (não mudam o site)
- `7804891` — seção "Como funciona" do Marketplace: estava no ar desde 04/11 mas faltava no GitHub. Baixada do site sem alterações.
- `51ffac3` — `.htaccess` da raiz (redireciona `home.html` para `/`): estava no ar e faltava no GitHub.

---

## Mudanças fora dos arquivos (não voltam com um commit)

**Banco de dados** (`buzzcode_marketplace_rural`, pelo phpMyAdmin do cPanel):
- `banco/migracoes/009_verificacao_email.sql`: criada sozinha pelo PHP no primeiro uso (coluna `email_verificado`, tabela `codigos_email`).
- `banco/migracoes/010_destaques_promocoes.sql`: aplicada à mão em 22/11, **antes** de publicar os arquivos (colunas `destaque` e `preco_promocional`; 6 destaques e 3 promoções de exemplo).

**DNS** (cPanel → Zone Editor):
- SPF corrigido em 22/11 (IP do servidor incluído).
- DMARC criado em 23/11: `_dmarc` TXT `v=DMARC1; p=none;` (não bloqueia nada, só melhora a entrega).
- DKIM: já existia (`default._domainkey`), status válido.

**E-mail**: conta `avisos@buzzcodex.com.br` criada em 22/11 (remetente dos códigos e avisos).

**Dados de exemplo** (pelo próprio site): 12 produtos com fotos do Unsplash na conta de produtor "Davi" (id 34), em 23/11.

---

## O que existe no servidor e NÃO fica no GitHub (de propósito)
- `backend/config/config.local.php` — senha do banco. Nunca enviar ao GitHub (modelo: `config.example.php`).
- `uploads/` — fotos enviadas pelos usuários.
- `error_log` — registros de erro do PHP.
- `api/` — API antiga (anterior à pasta `backend/`). O site atual não usa; ficou no servidor e nunca esteve no GitHub. Não apagar sem conferir se algo externo (app/placa) ainda chama.
- `.htaccess.phpupgrader.*`, `assets.zip` — cópias criadas pelo cPanel/upload antigo.
- `docs/` no servidor é uma cópia antiga; a versão certa é a do GitHub.

## Pastas do repositório que NÃO vão para o site
`marketplace-src/` (cópia antiga), `fazenda-3d/` (código-fonte; o site usa `frontend/vendor/fazenda-3d/`), `video-src/`, `iot/`, `deploy-*/`, `docs/`, `.claude/`.

## Fora deste projeto
- `planilha-pedidos/` e `catalogo/` na pasta do computador são do **catálogo** (conta pessoal davi17dev), não do TCC. Não enviar para este repositório.
