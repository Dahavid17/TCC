// Dados de EXEMPLO da Gestão da Fazenda (enquanto o produtor não tem um ESP32 enviando leituras).
//
// Gera exatamente o mesmo formato de backend/gestao/resumo.php ({ fazendas, resumo, sensores,
// dispositivos }), então o painel desenha tudo pelo mesmo caminho dos dados reais. Quando a
// primeira placa real enviar leituras, gestao-fazenda.js passa a usar só o backend e este
// arquivo deixa de ser usado — nada mais precisa mudar.
//
// As leituras "reagem" aos atuadores da automação (irrigação, ventilação, luz), para a
// demonstração mostrar a automação funcionando: a terra seca, a irrigação liga, a umidade sobe.
//
// Também simula o trator (Plano Pro), que hoje não tem sensor real equivalente.

window.GestaoDemo = (function () {

    const HISTORICO = 30;
    const CODIGO = "ESP32-EXEMPLO-01";

    // Mesmos tipos/nomes/unidades de SENSORES_ESTACAO (backend/lib/iot.php).
    const CATALOGO = [
        { tipo: "umidade_solo", nome: "Umidade do solo", unidade: "%", inicial: 41, min: 5, max: 95, passo: 0.6, deriva: -0.9 },
        { tipo: "temperatura", nome: "Temperatura do ar", unidade: "°C", inicial: 26.5, min: 10, max: 42, passo: 0.25, deriva: 0.18 },
        { tipo: "umidade_ar", nome: "Umidade do ar", unidade: "%", inicial: 66, min: 20, max: 98, passo: 1.2, deriva: 0 },
        { tipo: "luminosidade", nome: "Luminosidade", unidade: "lx", inicial: 15500, min: 0, max: 60000, passo: 900, deriva: -350 }
    ];

    const estado = {};
    let atuadores = { irrigacao: false, ventilacao: false, luz: false };

    function limitar(valor, s) {
        return Math.min(s.max, Math.max(s.min, valor));
    }

    function proximo(s, atual) {

        let deriva = s.deriva;

        // Efeito dos atuadores (o que a automação faria na fazenda de verdade).
        if (s.tipo === "umidade_solo" && atuadores.irrigacao) deriva = 2.6;
        if (s.tipo === "temperatura" && atuadores.ventilacao) deriva = -0.45;
        if (s.tipo === "umidade_ar" && atuadores.irrigacao) deriva = 0.6;
        if (s.tipo === "luminosidade") {
            deriva = atuadores.luz ? 2200 : s.deriva;
            if (atual > 26000) deriva = -900; // nuvem passando
        }

        const ruido = (Math.random() * 2 - 1) * s.passo;
        const valor = limitar(atual + deriva + ruido, s);

        return s.unidade === "lx" ? Math.round(valor) : Math.round(valor * 10) / 10;
    }

    function iniciar() {

        CATALOGO.forEach(s => {
            const historico = [];
            let valor = s.inicial + (s.deriva * -HISTORICO) * 0.5; // histórico começa "antes"
            for (let i = 0; i < HISTORICO; i++) {
                valor = proximo(s, valor);
                historico.push(valor);
            }
            estado[s.tipo] = historico;
        });

        // Últimos valores perto do inicial, para a demonstração começar num ponto conhecido.
        CATALOGO.forEach(s => {
            const h = estado[s.tipo];
            const ajuste = s.inicial - h[h.length - 1];
            estado[s.tipo] = h.map(v => s.unidade === "lx" ? Math.round(limitar(v + ajuste, s)) : Math.round(limitar(v + ajuste, s) * 10) / 10);
        });
    }

    function avancar() {
        CATALOGO.forEach(s => {
            const h = estado[s.tipo];
            h.push(proximo(s, h[h.length - 1]));
            if (h.length > HISTORICO) h.shift();
        });
    }

    // Uma "resposta" no formato de resumo.php. Cada chamada avança a simulação um passo.
    function gerar(plano) {

        if (!Object.keys(estado).length) iniciar();
        else avancar();

        const sensores = CATALOGO.map((s, i) => ({
            id: -(i + 1),                 // ids negativos: nunca colidem com o banco
            tipo: s.tipo,
            nome: s.nome,
            unidade: s.unidade,
            codigo: CODIGO,
            status: "ativo",
            valor: estado[s.tipo][estado[s.tipo].length - 1],
            segundos_sem_sinal: 2,
            historico: [...estado[s.tipo]],
            exemplo: true
        }));

        return {
            sucesso: true,
            exemplo: true,
            fazendas: [{ id: 0, nome: "Sítio Boa Vista (exemplo)", localizacao: "Arceburgo - MG", area_total: 12.5 }],
            resumo: { propriedades: 1, talhoes: 4, safras_ativas: 2, dispositivos: plano === "pro" ? 2 : 1 },
            sensores,
            dispositivos: [{ codigo: CODIGO, nome: "Estação da estufa (exemplo)", segundos_sem_sinal: 2, exemplo: true }]
        };
    }

    /* ---------- TRATOR (Plano Pro, sempre simulado por enquanto) ---------- */

    const trator = { velocidade: 7.2, combustivel: 64, rpm: 1850, temperatura: 88, carga: 35 };

    function gerarTrator() {

        const passo = (v, p, min, max) => Math.min(max, Math.max(min, v + (Math.random() * 2 - 1) * p));

        trator.velocidade = Math.round(passo(trator.velocidade, 0.5, 0, 14) * 10) / 10;
        trator.rpm = Math.round(passo(trator.rpm, 60, 900, 2500));
        trator.temperatura = Math.round(passo(trator.temperatura, 0.8, 70, 104));
        trator.combustivel = trator.combustivel <= 8 ? 100 : Math.round((trator.combustivel - 0.4) * 10) / 10;
        trator.carga = trator.carga >= 98 ? 5 : Math.round((trator.carga + 1.1) * 10) / 10;

        return { ...trator };
    }

    return {
        gerar,
        gerarTrator,
        definirAtuadores: (novos) => { atuadores = { ...atuadores, ...novos }; }
    };

})();
