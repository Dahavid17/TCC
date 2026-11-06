// Converte os sensores devolvidos por backend/gestao/resumo.php do Marketplace Rural
// (leituras reais dos ESP32 do produtor) para o formato de leituras da cena.
//
// Cada tipo do ESP32 alimenta um marcador da cena; os marcadores sem correspondente
// continuam simulados (e aparecem como "Simulado").
export const MAPA_TIPOS_REAIS = {
    umidade_solo: { id: "solo-umidade", campo: "umidade" },
    temperatura: { id: "estufa-temperatura", campo: "temperatura" },
    umidade_ar: { id: "estufa-umidade", campo: "umidade" },
    luminosidade: { id: "estufa-luminosidade", campo: "lux" },
};

export function leiturasDoResumo(sensoresDoResumo = []) {
    const reais = {};

    for (const sensor of sensoresDoResumo) {
        const alvo = MAPA_TIPOS_REAIS[sensor.tipo];

        // Se houver mais de uma placa com o mesmo tipo, vale a primeira com leitura.
        if (!alvo || reais[alvo.id] || sensor.valor === null || sensor.valor === undefined) continue;

        const segundos = sensor.segundos_sem_sinal ?? 0;

        reais[alvo.id] = {
            origem: "real",
            dispositivo: sensor.codigo,
            segundosSemSinal: segundos,
            atualizadoEm: new Date(Date.now() - segundos * 1000),
            campos: {
                [alvo.campo]: {
                    valor: sensor.valor,
                    historico: sensor.historico?.length ? sensor.historico : [sensor.valor],
                },
            },
        };
    }

    return reais;
}
