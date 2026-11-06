# API

| Área | Estado |
| --- | --- |
| `backend/auth` | Cadastro, login e logout disponíveis. |
| `backend/produtos` | Endpoints-base retornam HTTP 501. |
| `backend/pedidos` | Endpoints-base retornam HTTP 501. |
| `backend/usuarios` | Endpoints-base retornam HTTP 501. |
| `backend/gestao/resumo.php` | GET (sessão de produtor): propriedades, contadores e leituras reais dos sensores com histórico. |
| `backend/iot/dispositivos.php` | GET lista / POST (JSON) conecta um ESP32 ao produtor logado e devolve o token da placa. |
| `backend/iot/receber.php` | POST (JSON) com cabeçalho `X-Token-Dispositivo`: grava as leituras da placa. Detalhes em `docs/iot.md`. |
| `backend/negociacoes/listar.php` | GET: conversas do usuário (como comprador ou vendedor) com a última mensagem, não lidas, propostas enviadas e se a negociação foi concluída (pedido entregue). |
| `backend/negociacoes/mensagens.php` | GET `anuncio_id`, `comprador_id` (só o vendedor), `depois` (opcional): dados da conversa e mensagens; marca as recebidas como lidas. |
| `backend/negociacoes/enviar.php` | POST `anuncio_id`, `comprador_id` (só o vendedor), `mensagem`, `tipo` = `texto` ou `proposta` e `valor`. O comprador abre a conversa; o vendedor só responde. Requer a migração `banco/migracoes/005_chats_negociacoes.sql`. |
