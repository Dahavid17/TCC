// Classificação das leituras e formatação em pt-BR.

export const ROTULO_STATUS = { normal: "Normal", atencao: "Atenção", critico: "Crítico" };

export const COR_STATUS = { atencao: "#f2a516", critico: "#e5484d" };

const PESO = { normal: 0, atencao: 1, critico: 2 };

// Dentro da faixa ideal: normal. Até 25% da largura da faixa para fora: atenção. Além disso: crítico.
export function statusDoCampo(campo, valor) {
    if (!campo.ideal || valor === undefined || valor === null) return "normal";

    const [minimo, maximo] = campo.ideal;
    const margem = (maximo - minimo) * 0.25;

    if (valor >= minimo && valor <= maximo) return "normal";
    if (valor >= minimo - margem && valor <= maximo + margem) return "atencao";
    return "critico";
}

// O sensor assume o pior status entre os seus campos.
export function statusDoSensor(sensor, leitura) {
    if (!leitura) return "normal";

    return sensor.campos.reduce((pior, campo) => {
        const status = statusDoCampo(campo, leitura.campos[campo.chave]?.valor);
        return PESO[status] > PESO[pior] ? status : pior;
    }, "normal");
}

export function formatarNumero(valor, casas = 0) {
    if (valor === undefined || valor === null || Number.isNaN(valor)) return "—";
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatar(valor, campo) {
    return `${formatarNumero(valor, campo.casas)} ${campo.unidade}`.trim();
}

// Texto curto para listas: valor principal ou, no NPK, os três nutrientes.
export function resumoSensor(sensor, leitura) {
    const campos = leitura?.campos ?? {};

    if (sensor.exibicao === "barras") {
        return sensor.campos.map((c) => `${c.sigla ?? c.rotulo} ${formatarNumero(campos[c.chave]?.valor, c.casas)}`).join(" · ");
    }

    const principal = sensor.campos[0];
    return formatar(campos[principal.chave]?.valor, principal);
}
