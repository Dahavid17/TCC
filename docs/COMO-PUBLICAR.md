# Como publicar no site (e como voltar atrás)

Regra do projeto: **primeiro o GitHub, depois o site.** Nada vai para o cPanel sem estar num commit.
Cada etapa é um commit separado, com mensagem explicando o que mudou, para dar para voltar só aquela parte.

## Antes de começar
1. Repositório: `https://github.com/Dahavid17/TCC` (conta **Dahavid17**, a da escola).
   Neste computador há duas contas do GitHub salvas; para usar sempre a certa:
   ```
   git remote set-url origin https://Dahavid17@github.com/Dahavid17/TCC.git
   ```
2. `git pull` antes de mexer: outras sessões/computadores podem ter enviado commits.

## Publicar
1. **Commit e envio**: `git add …`, `git commit`, `git push`. Anote o código do commit (ex.: `1280e22`).
2. **Conferir o site**: os arquivos que serão trocados precisam estar iguais à versão publicada anterior.
   Se algum estiver diferente, alguém mexeu direto no servidor: traga essa mudança para o GitHub antes de continuar.
3. **Backup**: no cPanel → Gerenciador de Arquivos, copie os arquivos que serão trocados para
   `/home2/buzzcodexcom/backup-ASSUNTO-AAAA-MM-DD/` (nome com `__` no lugar de `/`, ex.: `frontend__js__inicio.js`).
4. **Banco antes dos arquivos**: se houver migração nova em `banco/migracoes/`, rode no phpMyAdmin *antes* de enviar os arquivos.
5. **Envio**: as pastas `frontend/css`, `frontend/js`, `frontend/pages` e `assets/img/favicon` ficam com permissão **0555**
   (só leitura). Mude para 0755, envie, e volte para 0555. As pastas de `backend/` ficam em 0755.
6. **Conferir**: cada arquivo do site deve ficar idêntico ao do GitHub naquele commit.
7. **Etiqueta**: marque o estado publicado e registre em `docs/HISTORICO-DE-VERSOES.md`:
   ```
   git tag -a publicado-AAAA-MM-DD-assunto <commit> -m "O que foi publicado"
   git push origin --tags
   ```
8. Se a tela antiga aparecer no navegador, é cache: **Ctrl+F5**. Ao mudar um CSS/JS, aumente o `?v=` no HTML que o carrega.

## Voltar uma versão

**Rápido (só o site):** no cPanel, copie de volta os arquivos da pasta `backup-…` daquela publicação para o lugar
original (tirando os `__` do nome). Isso desfaz a publicação no site, mas não no GitHub.

**Pelo GitHub (recomendado):**
- Desfazer um commit específico, mantendo os outros:
  ```
  git revert <commit>
  git push
  ```
  Depois publique os arquivos que o revert alterou (mesmo passo a passo acima).
- Ver como estava o site numa publicação: `git checkout publicado-2026-11-23-chat` (só para olhar; volte com `git checkout main`).
- Comparar duas publicações: `git diff publicado-2026-11-22-promocoes publicado-2026-11-23-perfil --stat`.

**Banco e DNS não voltam com o Git.** Se precisar desfazer:
- Migração 010: `ALTER TABLE anuncios DROP COLUMN destaque, DROP COLUMN preco_promocional;`
  (só depois de voltar os arquivos que usam essas colunas).
- DMARC: apagar o registro `_dmarc` no Zone Editor do cPanel.
