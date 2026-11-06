# Monitoramento IoT (ESP32 + Wokwi) na Gestão da Fazenda

A aba **Gestão da Fazenda** mostra, em tempo real, as leituras de uma estação ESP32
vinculada ao perfil do produtor: umidade do solo, temperatura do ar, umidade do ar e
luminosidade. Não há mais dados demonstrativos: sem placa conectada, a aba orienta a
conectar uma.

## Arquitetura

```
ESP32 no Wokwi ──MQTT 1883──► public.cloud.shiftr.io ◄──MQTT/WSS 443── ponte (iot/ponte-wokwi)
 DHT22, LDR, potenciômetro        (broker público)                          │ HTTP POST + token
                                                                            ▼
                                       Gestão da Fazenda ◄── resumo.php ◄── receber.php ──► MySQL
                                       (atualiza a cada 5 s)
```

- O ESP32 simulado tem internet (rede `Wokwi-GUEST`), mas não alcança o `localhost`
  deste computador. Por isso publica num broker MQTT e a **ponte** repassa para a API.
- A ponte usa WebSocket seguro na porta 443 porque a rede da escola descarta MQTT na 1883
  (testado: TCP abre, mas nenhum broker responde ao CONNECT).
- Quem autentica a gravação é a **placa**, não a sessão: cabeçalho `X-Token-Dispositivo`.
  O token é gerado ao conectar a placa e fica só na ponte (no banco, apenas o SHA-256).

| Peça | Arquivo |
| --- | --- |
| Circuito do Wokwi | `iot/wokwi/diagram.json`, `iot/wokwi/libraries.txt` |
| Firmware | `iot/wokwi/sketch.ino` (código da placa: `ESP32-MR-88CDA7`) |
| Ponte MQTT → API | `iot/ponte-wokwi/ponte.mjs` (+ `config.json`, fora do git) |
| Recebe leituras | `backend/iot/receber.php` |
| Conecta placa ao produtor | `backend/iot/dispositivos.php` |
| Resumo da aba | `backend/gestao/resumo.php` |
| Regras comuns | `backend/lib/iot.php` |
| Tabelas | `banco/migracoes/004_iot_sensores.sql` |
| Tela | `frontend/pages/gestao-fazenda.html`, `frontend/js/gestao-fazenda.js` |

### Ligações no ESP32 (DevKit C v4)

| Sensor | Pino do sensor | ESP32 |
| --- | --- | --- |
| DHT22 (temperatura e umidade do ar) | VCC / SDA / GND | 3V3 / GPIO 15 / GND |
| LDR – módulo fotoresistor (luminosidade) | VCC / AO / GND | 3V3 / GPIO 34 / GND |
| Potenciômetro (simula umidade do solo) | VCC / SIG / GND | 3V3 / GPIO 35 / GND |

GPIO 34 e 35 são do ADC1 (o ADC2 não funciona com o Wi-Fi ligado). A luminosidade é
convertida para lux pela curva do fotoresistor do Wokwi; o potenciômetro vira 0–100 %.

## Rodando localmente

1. **Banco + site** — na raiz do projeto:
   `powershell -ExecutionPolicy Bypass -File dev\iniciar-local.ps1`
   Cria um MySQL de testes isolado na porta 3307 (não mexe no MySQL principal), o banco
   `marketplace_rural_dev` e uma conta de produtor de teste (veja `dev/seed-dev.sql`).
   O site fica em `http://127.0.0.1:8080`.
2. **Wokwi** — abra um projeto ESP32, cole `diagram.json` e `sketch.ino`, adicione as
   bibliotecas de `libraries.txt` e clique em ▶. O monitor serial mostra o código da placa.
3. **Conectar a placa** — entre como produtor, abra *Gestão da Fazenda > Conectar ESP32*,
   informe o código e copie o token exibido.
4. **Ponte** — em `iot/ponte-wokwi`: copie `config.example.json` para `config.json`, cole o
   token ao lado do código, rode `npm install` (uma vez) e `npm start`.
   Cada leitura repassada aparece como `OK  ESP32-MR-88CDA7 #N ...`.

### Limitação do simulador

O Wokwi roda no navegador: com a aba **oculta ou a janela minimizada**, o Chromium
reduz a simulação a cerca de 1 % da velocidade e o broker acaba derrubando a conexão por
inatividade. Para a demonstração, mantenha a janela do Wokwi visível (pode ser pequena,
num canto da tela ou em outro monitor).

## Produção (buzzcodex.com.br)

1. Faça backup e execute `banco/migracoes/004_iot_sensores.sql` no phpMyAdmin. Se as
   tabelas `sensores_iot`/`leituras_iot` já existirem no servidor, confira os tipos das
   colunas como descrito no cabeçalho da migração.
2. Publique os arquivos de `backend/iot`, `backend/lib/iot.php`, `backend/gestao/resumo.php`,
   `backend/config/conexao.php` e os da tela.
3. A ponte pode apontar para o servidor (`"api": "https://buzzcodex.com.br/backend/iot/receber.php"`).
   Uma placa real também pode chamar essa URL direto via HTTPS, dispensando o broker.

## Segurança e limites

- O broker público é aberto: qualquer pessoa que conheça o tópico pode ler as leituras ou
  publicar valores falsos, que a ponte repassaria com o token. Para uso real, use um broker
  com usuário/senha próprios (ou HTTPS direto da placa).
- `receber.php` valida faixa de cada sensor e exige o token; `dispositivos.php` só aceita
  JSON (evita CSRF por formulário) e impede que um código já vinculado a outro produtor
  seja tomado. Reenviar o código da sua placa gera um token novo.
- Cada placa grava 4 linhas a cada 5 s de simulação; para uso contínuo, crie uma rotina
  que apague leituras antigas de `leituras_iot`.
