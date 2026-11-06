# Deploy — IoT na Gestão da Fazenda + tour do Broto

Destino: `/home2/buzzcodexcom/public_html` (buzzcodex.com.br).

**Status: ENVIADO em 06/11/2026.** Tabela `dispositivos_iot` criada; os 12 arquivos do zip e
as edições de `inicio.html`/`configuracoes.html` publicados e conferidos byte a byte via HTTPS.
Backups dos 11 arquivos substituídos: `/home2/buzzcodexcom/backup-iot-2026-11-06/`
(nome com `__` no lugar de `/`). Para desfazer, copie de volta e mantenha a tabela.

Atenção para próximos deploys pelo cPanel: `Fileman/get_file_content` insere
`<meta charset="utf-8">` logo após o primeiro `<head` ao LER (inclusive `<header>` em JS).
Não edite arquivos lendo por essa API; envie com `Fileman/upload_files`, que grava os bytes exatos.

## 1. Banco (antes dos arquivos)

No phpMyAdmin, banco `buzzcode_marketplace_rural`, aba SQL: execute `dispositivos_iot.sql`.
As tabelas `fazendas`, `talhoes`, `safras`, `sensores_iot` e `leituras_iot` já existem
e não são alteradas. Sem a tabela nova, `resumo.php` falha e a aba Gestão da Fazenda não abre.

## 2. Arquivos (`marketplace-iot.zip`)

Extraia na raiz do site. Faça backup antes dos que já existem:

| Arquivo | Situação no servidor |
| --- | --- |
| `backend/lib/iot.php`, `backend/iot/receber.php`, `backend/iot/dispositivos.php` | novos |
| `backend/gestao/resumo.php`, `backend/config/conexao.php` | substituem a versão de 29/10 |
| `frontend/pages/gestao-fazenda.html`, `frontend/js/gestao-fazenda.js`, `frontend/css/gestao-fazenda.css` | substituem a versão com dados demonstrativos |
| `frontend/js/onboarding.js`, `frontend/css/onboarding.css` | substituem a versão do pacote do onboarding |
| `frontend/js/configuracoes.js`, `frontend/css/configuracoes.css` | servidor = versão anterior destes |

`frontend/css`, `frontend/js` e `frontend/pages` estão com permissão 0555 no servidor:
mude para 0755 para gravar e volte para 0555 depois.

## 3. Edições no lugar (não estão no zip)

Estes dois arquivos têm ajustes feitos direto no servidor; edite só estas linhas:

- `frontend/pages/inicio.html`: `onboarding.css?v=1` → `onboarding.css?v=2` e
  `onboarding.js?v=1` → `onboarding.js?v=3`.
- `frontend/pages/configuracoes.html`: `configuracoes.css?v=2` → `?v=3`,
  `configuracoes.js?v=2` → `?v=3` e, logo depois do cartão "Tour do Broto"
  (o `</div>` após o link `inicio.html?tour=1`), inclua:

```html
              <div class="switch-card" id="cartaoTourGestao" hidden>
                <div>
                  <strong>Tour da Gestão da Fazenda</strong>

                  <p>Rever com o Broto a propriedade, o ESP32 e os sensores ao vivo.</p>
                </div>

                <a href="gestao-fazenda.html?tour=1" class="btn-principal btn-tour">Ver tour da Gestão</a>
              </div>
```

## 4. Conferência

- `https://buzzcodex.com.br/backend/iot/receber.php` (POST sem token) → 401 em JSON.
- Gestão da Fazenda logado como produtor: o Broto abre no primeiro acesso; sem placa,
  aparece "Nenhum ESP32 conectado".
- Para a ponte gravar em produção, troque `api` em `iot/ponte-wokwi/config.json` para
  `https://buzzcodex.com.br/backend/iot/receber.php` e conecte a placa de novo na aba
  (o token é do banco de produção, não do local).
