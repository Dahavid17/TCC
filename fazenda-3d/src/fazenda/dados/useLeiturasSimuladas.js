import { useEffect, useState } from "react";

// Gera leituras "ao vivo" para os sensores da cena.
//
// Formato devolvido (o mesmo que um hook com dados reais deve devolver):
//   { [sensorId]: { atualizadoEm: Date, campos: { [chave]: { valor, historico: number[] } } } }
//
// Para usar dados reais, escreva um hook com essa mesma saída (ex.: consultando
// backend/gestao/resumo.php a cada 5 s) e troque o import em FazendaInteligente.jsx.

export function proximoValor(campo, atual) {
    const centro = campo.ideal ? (campo.ideal[0] + campo.ideal[1]) / 2 : campo.inicial;
    const retorno = campo.retorno ?? 0.06;
    const deriva = campo.deriva ?? 0;

    let novo = atual + (centro - atual) * retorno + (Math.random() * 2 - 1) * campo.passo + deriva;

    if (campo.pico && Math.random() < campo.pico) {
        novo += (Math.random() < 0.5 ? -1 : 1) * campo.passo * 10;
    }

    if (campo.ciclo) {
        if (deriva < 0 && novo <= campo.min) novo = campo.max; // abasteceu
        if (deriva > 0 && novo >= campo.max) novo = campo.min; // descarregou
    }

    return Math.min(campo.max, Math.max(campo.min, novo));
}

function calcularDerivados(sensor, valores) {
    for (const campo of sensor.campos) {
        if (campo.derivar) {
            valores[campo.chave] = Math.min(campo.max, Math.max(campo.min, campo.derivar(valores)));
        }
    }
    return valores;
}

function leituraSeguinte(sensor, anterior, tamanhoHistorico) {
    const valores = {};

    for (const campo of sensor.campos) {
        if (campo.derivar) continue;
        const atual = anterior?.campos[campo.chave]?.valor ?? campo.inicial;
        valores[campo.chave] = anterior ? proximoValor(campo, atual) : campo.inicial;
    }

    calcularDerivados(sensor, valores);

    const campos = {};
    for (const campo of sensor.campos) {
        const historico = [...(anterior?.campos[campo.chave]?.historico ?? []), valores[campo.chave]];
        campos[campo.chave] = { valor: valores[campo.chave], historico: historico.slice(-tamanhoHistorico) };
    }

    return { atualizadoEm: new Date(), campos };
}

function estadoInicial(sensores, tamanhoHistorico) {
    const estado = {};

    for (const sensor of sensores) {
        // Já começa com histórico para os gráficos não nascerem vazios.
        let leitura = leituraSeguinte(sensor, null, tamanhoHistorico);
        for (let i = 1; i < tamanhoHistorico; i++) {
            leitura = leituraSeguinte(sensor, leitura, tamanhoHistorico);
        }
        estado[sensor.id] = leitura;
    }

    return estado;
}

export function useLeiturasSimuladas(sensores, intervaloMs = 1500, tamanhoHistorico = 24) {
    const [leituras, setLeituras] = useState(() => estadoInicial(sensores, tamanhoHistorico));

    useEffect(() => {
        const id = setInterval(() => {
            setLeituras((anterior) => {
                const proximo = {};
                for (const sensor of sensores) {
                    proximo[sensor.id] = leituraSeguinte(sensor, anterior[sensor.id], tamanhoHistorico);
                }
                return proximo;
            });
        }, intervaloMs);

        return () => clearInterval(id);
    }, [sensores, intervaloMs, tamanhoHistorico]);

    return leituras;
}
