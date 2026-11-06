import { useEffect, useRef, useState } from "react";
import { COR_STATUS, ROTULO_STATUS, formatar, formatarNumero, statusDoCampo } from "../dados/status";

const MARGEM = 8;

function tempoDesde(segundos = 0) {
    if (segundos < 5) return "agora";
    if (segundos < 60) return `há ${segundos} s`;
    if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
    return `sem sinal há ${Math.floor(segundos / 3600)} h`;
}

// Mantém o painel dentro da área da cena: abre para baixo se faltar espaço em cima
// e desliza para o lado perto das bordas. Recalcula a cada quadro (a câmera e o trator se movem).
function usePosicaoDentroDaCena() {
    const ref = useRef(null);
    const [posicao, setPosicao] = useState({ abaixo: false, dx: 0 });

    useEffect(() => {
        let quadro;

        const medir = () => {
            const el = ref.current;
            const area = el?.closest(".fazenda-3d")?.getBoundingClientRect();
            const ancora = el?.parentElement?.getBoundingClientRect();

            if (el && area && ancora) {
                const largura = el.offsetWidth;
                const altura = el.offsetHeight;
                const abaixo = ancora.top - area.top < altura + 14 + MARGEM;
                const esquerda = ancora.left - largura / 2;
                let dx = 0;

                if (esquerda < area.left + MARGEM) dx = area.left + MARGEM - esquerda;
                if (esquerda + largura > area.right - MARGEM) dx = area.right - MARGEM - (esquerda + largura);

                setPosicao((atual) =>
                    atual.abaixo === abaixo && Math.abs(atual.dx - dx) < 1 ? atual : { abaixo, dx: Math.round(dx) }
                );
            }

            quadro = requestAnimationFrame(medir);
        };

        medir();
        return () => cancelAnimationFrame(quadro);
    }, []);

    return [ref, posicao];
}

// Painel HTML exibido sobre o canvas, ancorado ao marcador (via <Html> do drei).
export function PainelSensor({ sensor, grupo, leitura, status, fixo, onFechar }) {
    const [principal, ...outros] = sensor.campos;
    const dados = leitura?.campos ?? {};
    const cor = status === "normal" ? grupo.cor : COR_STATUS[status];
    const [ancoraRef, posicao] = usePosicaoDentroDaCena();

    return (
        <div
            ref={ancoraRef}
            className={`painel-ancora ${posicao.abaixo ? "abaixo" : ""}`}
            style={{ "--dx": `${posicao.dx}px` }}
        >
            <div className={`painel-sensor painel-${status}`} style={{ "--cor-grupo": grupo.cor, "--cor-linha": cor }}>
                <div className="painel-topo">
                    <span className="painel-sigla" aria-hidden="true">{sensor.sigla}</span>
                    <div className="painel-titulo">
                        <strong>{sensor.nome}</strong>
                        <small>{grupo.nome} · {sensor.local}</small>
                    </div>
                    {fixo && (
                        <button type="button" className="painel-fechar" onClick={onFechar} aria-label={`Fechar ${sensor.nome}`}>
                            ×
                        </button>
                    )}
                </div>

                {sensor.exibicao === "barras" ? (
                    <Barras campos={sensor.campos} dados={dados} />
                ) : (
                    <>
                        <div className="painel-valor">
                            {formatarNumero(dados[principal.chave]?.valor, principal.casas)}
                            <span>{principal.unidade}</span>
                        </div>
                        <Grafico valores={dados[principal.chave]?.historico ?? []} campo={principal} />
                        {outros.length > 0 && (
                            <dl className="painel-campos">
                                {outros.map((c) => (
                                    <div key={c.chave} className={`campo-${statusDoCampo(c, dados[c.chave]?.valor)}`}>
                                        <dt>{c.rotulo}</dt>
                                        <dd>{formatar(dados[c.chave]?.valor, c)}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </>
                )}

                <div className="painel-rodape">
                    <span className="painel-status">{ROTULO_STATUS[status]}</span>
                    {principal.ideal && sensor.exibicao !== "barras" && (
                        <span>
                            Ideal {formatarNumero(principal.ideal[0], principal.casas)}–{formatarNumero(principal.ideal[1], principal.casas)} {principal.unidade}
                        </span>
                    )}
                </div>
                {leitura?.origem === "real" ? (
                    <div className={`painel-dispositivo real ${leitura.segundosSemSinal > 90 ? "sem-sinal" : ""}`}>
                        <span className="painel-ao-vivo" aria-hidden="true" />
                        Leitura real · {leitura.dispositivo} · {tempoDesde(leitura.segundosSemSinal)}
                    </div>
                ) : (
                    <div className="painel-dispositivo">
                        <span className="painel-ao-vivo" aria-hidden="true" />
                        Simulado · {sensor.dispositivo} · {leitura?.atualizadoEm?.toLocaleTimeString("pt-BR") ?? "—"}
                    </div>
                )}
            </div>
        </div>
    );
}

function Grafico({ valores, campo }) {
    if (valores.length < 2) return null;

    const largura = 200;
    const altura = 38;
    let minimo = Math.min(...valores);
    let maximo = Math.max(...valores);

    if (campo.ideal) {
        minimo = Math.min(minimo, campo.ideal[0]);
        maximo = Math.max(maximo, campo.ideal[1]);
    }

    const faixa = maximo - minimo || 1;
    const y = (v) => altura - 3 - ((v - minimo) / faixa) * (altura - 6);
    const pontos = valores.map((v, i) => `${((i / (valores.length - 1)) * largura).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

    return (
        <svg className="painel-grafico" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-hidden="true">
            {campo.ideal && (
                <rect className="painel-faixa-ideal" x="0" width={largura} y={y(campo.ideal[1])} height={Math.max(1, y(campo.ideal[0]) - y(campo.ideal[1]))} />
            )}
            <polyline points={pontos} fill="none" stroke="var(--cor-linha)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

function Barras({ campos, dados }) {
    return (
        <div className="painel-barras">
            {campos.map((c) => {
                const valor = dados[c.chave]?.valor ?? c.min;
                const escala = (v) => ((v - c.min) / (c.max - c.min)) * 100;

                return (
                    <div key={c.chave} className={`barra barra-${statusDoCampo(c, valor)}`}>
                        <div className="barra-topo">
                            <span>{c.rotulo}</span>
                            <strong>{formatar(valor, c)}</strong>
                        </div>
                        <div className="barra-trilho">
                            {c.ideal && (
                                <span className="barra-ideal" style={{ left: `${escala(c.ideal[0])}%`, width: `${escala(c.ideal[1]) - escala(c.ideal[0])}%` }} />
                            )}
                            <span className="barra-valor" style={{ width: `${Math.max(2, escala(valor))}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
