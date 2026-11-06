// Ponte Wokwi -> Marketplace Rural
//
// O ESP32 simulado no Wokwi tem internet (rede Wokwi-GUEST), mas não enxerga o
// localhost deste computador. Por isso ele publica as leituras num broker MQTT e
// esta ponte, rodando aqui, assina o tópico e repassa cada leitura para a API do
// marketplace (backend/iot/receber.php), autenticando com o token da placa.
//
//   ESP32 (Wokwi) --MQTT--> broker --MQTT--> ponte --HTTP POST--> receber.php --> MySQL
//
// Uso:  npm install   (uma vez)   e depois   npm start
// Configuração: config.json (copie de config.example.json). Ele é relido quando
// muda, então dá para colar o token de uma placa nova sem reiniciar a ponte.

import mqtt from "mqtt";
import { existsSync, readFileSync, watchFile } from "node:fs";
import { fileURLToPath } from "node:url";

const ARQUIVO_CONFIG = fileURLToPath(new URL("./config.json", import.meta.url));
const PREFIXO_TOPICO = "marketplace-rural/dispositivos";

function hora() {
    return new Date().toLocaleTimeString("pt-BR");
}

function log(mensagem) {
    console.log(`[${hora()}] ${mensagem}`);
}

function lerConfig() {
    if (!existsSync(ARQUIVO_CONFIG)) {
        console.error("Arquivo config.json não encontrado. Copie config.example.json para config.json e preencha.");
        process.exit(1);
    }

    const bruto = JSON.parse(readFileSync(ARQUIVO_CONFIG, "utf8"));
    const dispositivos = {};

    for (const [codigo, token] of Object.entries(bruto.dispositivos || {})) {
        if (typeof token === "string" && /^[0-9a-f]{48}$/i.test(token)) {
            dispositivos[codigo.trim().toUpperCase()] = token;
        }
    }

    return {
        // WebSocket seguro na 443: funciona mesmo em redes que bloqueiam MQTT na 1883.
        broker: process.env.MQTT_URL || bruto.broker || "wss://public.cloud.shiftr.io:443",
        brokerUsuario: bruto.broker_usuario ?? "public",
        brokerSenha: bruto.broker_senha ?? "public",
        api: process.env.API_URL || bruto.api || "http://127.0.0.1:8080/backend/iot/receber.php",
        dispositivos,
    };
}

let config = lerConfig();
const avisados = new Set();

watchFile(ARQUIVO_CONFIG, { interval: 2000 }, () => {
    try {
        config = lerConfig();
        avisados.clear();
        log(`config.json recarregado: ${Object.keys(config.dispositivos).length} placa(s) com token.`);
    } catch (erro) {
        log(`config.json inválido, mantendo a configuração anterior (${erro.message}).`);
    }
});

async function repassar(codigo, leitura) {
    const token = config.dispositivos[codigo];

    if (!token) {
        if (!avisados.has(codigo)) {
            avisados.add(codigo);
            log(`Placa ${codigo} publicando, mas sem token em config.json. Conecte-a em Gestão da Fazenda > Conectar ESP32 e cole o token.`);
        }
        return;
    }

    try {
        const resposta = await fetch(config.api, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Token-Dispositivo": token },
            body: JSON.stringify(leitura),
            signal: AbortSignal.timeout(10000),
        });
        const corpo = await resposta.json().catch(() => ({}));

        if (resposta.ok) {
            log(`OK  ${codigo} #${leitura.seq ?? "-"}  solo ${leitura.umidade_solo}%  ${leitura.temperatura}°C  ar ${leitura.umidade_ar}%  ${leitura.luminosidade} lx  -> ${corpo.gravadas} leituras gravadas`);
        } else {
            log(`ERRO ${codigo}: API respondeu ${resposta.status} - ${corpo.mensagem || "sem mensagem"}`);
        }
    } catch (erro) {
        log(`ERRO ${codigo}: API indisponível em ${config.api} (${erro.message})`);
    }
}

const cliente = mqtt.connect(config.broker, {
    clientId: `ponte-marketplace-${Math.random().toString(16).slice(2, 10)}`,
    username: config.brokerUsuario || undefined,
    password: config.brokerSenha || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 15000,
});

cliente.on("connect", () => {
    const topico = `${PREFIXO_TOPICO}/+/leituras`;

    cliente.subscribe(topico, { qos: 0 }, (erro) => {
        if (erro) {
            log(`Não foi possível assinar ${topico}: ${erro.message}`);
            return;
        }

        log(`Conectado a ${config.broker}. Aguardando leituras em ${topico}`);
        log(`Repassando para ${config.api} (${Object.keys(config.dispositivos).length} placa(s) com token).`);
    });
});

cliente.on("reconnect", () => log("Reconectando ao broker..."));
cliente.on("error", (erro) => log(`Erro MQTT: ${erro.message}`));

cliente.on("message", (topico, mensagem) => {
    const codigo = (topico.split("/")[2] || "").toUpperCase();
    let leitura;

    try {
        leitura = JSON.parse(mensagem.toString("utf8"));
    } catch {
        return; // ignora mensagens que não são JSON
    }

    if (!leitura || typeof leitura !== "object" || String(leitura.dispositivo || "").toUpperCase() !== codigo) {
        return; // o código no tópico precisa bater com o do corpo
    }

    repassar(codigo, leitura);
});

process.on("SIGINT", () => {
    log("Encerrando a ponte.");
    cliente.end(true, () => process.exit(0));
});
