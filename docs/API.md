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
