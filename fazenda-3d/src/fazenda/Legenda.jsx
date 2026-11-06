import { useState } from "react";
import { GRUPOS, SENSORES } from "./dados/sensores";
import { ROTULO_STATUS, resumoSensor } from "./dados/status";

// Painel lateral com todos os sensores (também é a forma de acesso pelo teclado).
// Clicar em um item fixa o painel do sensor na cena.
//   comDadosReais: a cena mistura leituras reais e simuladas; os simulados ganham a etiqueta "Simulado".
//   incorporado: a cena está dentro de outra página, então os títulos descem de nível.
export function Legenda({ titulo, leituras, status, selecionado, onSelecionar, comDadosReais = false, incorporado = false }) {
    const alertas = SENSORES.filter((s) => status[s.id] !== "normal").length;
    const reais = SENSORES.filter((s) => leituras[s.id]?.origem === "real").length;
    const Titulo = incorporado ? "h3" : "h1";
    const TituloGrupo = incorporado ? "h4" : "h2";
    // No celular a lista começa recolhida para não cobrir a cena.
    const [abertaNoInicio] = useState(() => !window.matchMedia?.("(max-width: 640px)").matches);

    return (
        <aside className="fazenda-legenda" aria-label="Sensores da fazenda">
            <div className="legenda-cabecalho">
                <Titulo className="legenda-titulo">{titulo}</Titulo>
                <span className="legenda-ao-vivo">
                    <span className="ponto-ao-vivo" aria-hidden="true" /> {comDadosReais ? "Ao vivo" : "Simulação ao vivo"}
                </span>
            </div>

            <p className={`legenda-resumo ${alertas ? "com-alerta" : ""}`} aria-live="polite">
                {comDadosReais ? `${reais} reais · ${SENSORES.length - reais} simulados` : `${SENSORES.length} sensores`}
                {" · "}
                {alertas ? `${alertas} em alerta` : "todos normais"}
            </p>

            <details open={abertaNoInicio}>
                <summary>Sensores</summary>

                {Object.entries(GRUPOS).map(([chave, grupo]) => (
                    <section key={chave} className="legenda-grupo">
                        <TituloGrupo className="legenda-grupo-titulo">
                            <span className="legenda-cor" style={{ background: grupo.cor }} aria-hidden="true" />
                            {grupo.nome}
                        </TituloGrupo>
                        <ul>
                            {SENSORES.filter((s) => s.grupo === chave).map((sensor) => {
                                const simulado = comDadosReais && leituras[sensor.id]?.origem !== "real";

                                return (
                                    <li key={sensor.id}>
                                        <button
                                            type="button"
                                            className={`legenda-item status-${status[sensor.id]}`}
                                            aria-pressed={selecionado === sensor.id}
                                            onClick={() => onSelecionar(sensor.id)}
                                            title={`${sensor.nome}: ${ROTULO_STATUS[status[sensor.id]]}${simulado ? " (simulado)" : ""}`}
                                        >
                                            <span className="legenda-status" aria-hidden="true" />
                                            <span className="legenda-nome">
                                                <span className="legenda-nome-texto">{sensor.nomeCurto ?? sensor.nome}</span>
                                                {simulado && <span className="legenda-simulado">Simulado</span>}
                                            </span>
                                            <span className="legenda-valor">{resumoSensor(sensor, leituras[sensor.id])}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </details>
        </aside>
    );
}
