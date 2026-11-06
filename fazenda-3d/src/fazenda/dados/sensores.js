// Catálogo dos sensores da cena.
//
// Cada sensor tem um ou mais "campos" (o primeiro é o valor principal do painel):
//   inicial/min/max  valor de partida e limites da simulação
//   passo            variação aleatória máxima a cada leitura
//   ideal [a, b]     faixa ideal; fora dela o marcador fica amarelo (atenção) ou vermelho (crítico)
//   deriva           tendência por leitura (combustível cai, carga sobe)
//   ciclo            ao bater no limite, recomeça (abastece / descarrega)
//   pico             chance de um salto brusco a cada leitura (gera alertas na demonstração)
//   retorno          força que puxa o valor de volta ao centro da faixa ideal (padrão 0.06)
//   derivar(v)       campo calculado a partir dos outros campos do mesmo sensor
//
// posicao: [x, y, z] na cena. Sensores com ancora "trator" usam coordenadas do próprio
// trator e andam junto com ele. haste: altura do pino até a cabeça do marcador.

export const GRUPOS = {
    // Violeta (e não verde) para o marcador se destacar sobre a lavoura.
    plantacao: { nome: "Plantação", cor: "#8b5cf6" },
    estufa: { nome: "Estufa inteligente", cor: "#1e9fd0" },
    maquinario: { nome: "Maquinário", cor: "#ef8a1f" },
};

export const SENSORES = [
    // ---------- PLANTAÇÃO ----------
    {
        id: "solo-umidade",
        grupo: "plantacao",
        nome: "Umidade do solo",
        sigla: "H₂O",
        local: "Fileira 2 · milho",
        dispositivo: "ESP32-PL-01",
        posicao: [-8.1, 0.28, -2.4],
        campos: [
            { chave: "umidade", rotulo: "Umidade", unidade: "%", inicial: 46, min: 0, max: 100, passo: 1.4, ideal: [35, 60], casas: 1, pico: 0.03 },
        ],
    },
    {
        id: "solo-temperatura",
        grupo: "plantacao",
        nome: "Temperatura da terra",
        sigla: "°C",
        local: "Fileira 4 · hortaliças",
        dispositivo: "ESP32-PL-02",
        posicao: [-5.3, 0.28, 2.6],
        campos: [
            { chave: "temperatura", rotulo: "Temperatura", unidade: "°C", inicial: 22.5, min: 5, max: 45, passo: 0.35, ideal: [18, 27], casas: 1 },
        ],
    },
    {
        id: "solo-npk",
        grupo: "plantacao",
        nome: "Nutrientes do solo (NPK)",
        nomeCurto: "NPK",
        sigla: "NPK",
        local: "Fileira 5 · hortaliças",
        dispositivo: "ESP32-PL-03",
        posicao: [-3.9, 0.28, -4.2],
        exibicao: "barras",
        campos: [
            { chave: "n", rotulo: "Nitrogênio (N)", sigla: "N", unidade: "mg/kg", inicial: 42, min: 0, max: 120, passo: 1.6, ideal: [30, 60], casas: 0, pico: 0.02 },
            { chave: "p", rotulo: "Fósforo (P)", sigla: "P", unidade: "mg/kg", inicial: 28, min: 0, max: 80, passo: 1, ideal: [20, 40], casas: 0 },
            { chave: "k", rotulo: "Potássio (K)", sigla: "K", unidade: "mg/kg", inicial: 160, min: 40, max: 320, passo: 4, ideal: [120, 200], casas: 0 },
        ],
    },

    // ---------- ESTUFA ----------
    {
        id: "estufa-temperatura",
        grupo: "estufa",
        nome: "Temperatura ambiente",
        sigla: "°C",
        local: "Bancada A",
        dispositivo: "ESP32-ES-01",
        posicao: [4.15, 1.1, -5.2],
        haste: 0.55,
        campos: [
            { chave: "temperatura", rotulo: "Temperatura", unidade: "°C", inicial: 25.4, min: 10, max: 45, passo: 0.3, ideal: [20, 28], casas: 1 },
        ],
    },
    {
        id: "estufa-umidade",
        grupo: "estufa",
        nome: "Umidade do ar",
        sigla: "UR",
        local: "Bancada B",
        dispositivo: "ESP32-ES-02",
        posicao: [5.65, 1.1, -2.8],
        haste: 0.55,
        campos: [
            { chave: "umidade", rotulo: "Umidade relativa", unidade: "%", inicial: 68, min: 20, max: 100, passo: 1, ideal: [60, 80], casas: 0 },
        ],
    },
    {
        id: "estufa-luminosidade",
        grupo: "estufa",
        nome: "Luminosidade",
        sigla: "lx",
        local: "Teto · Bancada A",
        dispositivo: "ESP32-ES-03",
        posicao: [7.15, 1.1, -5.2],
        haste: 0.95,
        campos: [
            { chave: "lux", rotulo: "Iluminância", unidade: "lx", inicial: 18500, min: 0, max: 60000, passo: 900, ideal: [12000, 30000], casas: 0 },
        ],
    },
    {
        id: "estufa-co2",
        grupo: "estufa",
        nome: "Nível de CO₂",
        sigla: "CO₂",
        local: "Bancada B",
        dispositivo: "ESP32-ES-04",
        posicao: [7.9, 1.1, -2.8],
        haste: 0.55,
        campos: [
            { chave: "co2", rotulo: "CO₂", unidade: "ppm", inicial: 820, min: 350, max: 2000, passo: 25, ideal: [600, 1200], casas: 0, pico: 0.03 },
        ],
    },

    // ---------- MAQUINÁRIO (preso ao trator) ----------
    {
        id: "trator-gps",
        grupo: "maquinario",
        nome: "Telemetria / GPS",
        sigla: "GPS",
        local: "Trator TR-01 · cabine",
        dispositivo: "ESP32-MQ-01",
        ancora: "trator",
        posicao: [0, 2.12, -0.45],
        haste: 0.35,
        campos: [
            { chave: "velocidade", rotulo: "Velocidade", unidade: "km/h", inicial: 7.2, min: 0, max: 15, passo: 0.4, ideal: [4, 10], casas: 1 },
            { chave: "latitude", rotulo: "Latitude", unidade: "°", inicial: -21.36024, min: -21.4, max: -21.3, passo: 0.00004, casas: 5 },
            { chave: "longitude", rotulo: "Longitude", unidade: "°", inicial: -46.94113, min: -47, max: -46.9, passo: 0.00004, casas: 5 },
            { chave: "satelites", rotulo: "Satélites", unidade: "", inicial: 9, min: 3, max: 14, passo: 0.6, ideal: [6, 14], casas: 0 },
        ],
    },
    {
        id: "trator-combustivel",
        grupo: "maquinario",
        nome: "Nível de combustível",
        nomeCurto: "Combustível",
        sigla: "DSL",
        local: "Trator TR-01 · tanque",
        dispositivo: "ESP32-MQ-02",
        ancora: "trator",
        posicao: [0.55, 0.98, 0.25],
        haste: 0.45,
        campos: [
            { chave: "nivel", rotulo: "Nível", unidade: "%", inicial: 64, min: 0, max: 100, passo: 0.05, deriva: -0.3, retorno: 0, ciclo: true, ideal: [25, 100], casas: 0 },
            { chave: "consumo", rotulo: "Consumo", unidade: "L/h", inicial: 9.5, min: 4, max: 16, passo: 0.3, ideal: [6, 12], casas: 1 },
        ],
    },
    {
        id: "trator-motor",
        grupo: "maquinario",
        nome: "Status do motor",
        nomeCurto: "Motor",
        sigla: "RPM",
        local: "Trator TR-01 · motor diesel",
        dispositivo: "ESP32-MQ-03",
        ancora: "trator",
        posicao: [0, 1.22, 0.62],
        haste: 0.4,
        campos: [
            { chave: "rpm", rotulo: "Rotação", unidade: "rpm", inicial: 1850, min: 800, max: 2600, passo: 40, ideal: [1500, 2200], casas: 0 },
            { chave: "temperatura", rotulo: "Temperatura", unidade: "°C", inicial: 88, min: 60, max: 115, passo: 0.6, ideal: [80, 95], casas: 0 },
            { chave: "oleo", rotulo: "Pressão do óleo", unidade: "bar", inicial: 3.4, min: 1, max: 5, passo: 0.08, ideal: [2.5, 4.5], casas: 1 },
        ],
    },
    {
        id: "trator-carga",
        grupo: "maquinario",
        nome: "Carga da carreta",
        nomeCurto: "Carga",
        sigla: "KG",
        local: "Carreta graneleira",
        dispositivo: "ESP32-MQ-04",
        ancora: "trator",
        posicao: [0, 1.2, -2.45],
        haste: 0.45,
        campos: [
            { chave: "carga", rotulo: "Ocupação", unidade: "%", inicial: 35, min: 0, max: 100, passo: 0.3, deriva: 0.7, retorno: 0, ciclo: true, ideal: [0, 90], casas: 0 },
            // Calculado a partir dos outros campos (capacidade de 4,2 t).
            { chave: "peso", rotulo: "Peso estimado", unidade: "kg", min: 0, max: 4200, casas: 0, derivar: (valores) => valores.carga * 42 },
        ],
    },
];
