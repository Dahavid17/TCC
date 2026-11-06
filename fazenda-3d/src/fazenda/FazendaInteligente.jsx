import { Suspense, useCallback, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Cena } from "./Cena";
import { Legenda } from "./Legenda";
import { SENSORES } from "./dados/sensores";
import { statusDoSensor } from "./dados/status";
import { useLeiturasSimuladas } from "./dados/useLeiturasSimuladas";
import "./fazenda.css";

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.4;

// Componente principal. Ocupa 100% do elemento pai (dê uma altura a ele).
//   intervaloMs    de quanto em quanto tempo os sensores simulados atualizam
//   leiturasReais  leituras de sensores reais ({ [sensorId]: { origem: "real", campos, ... } });
//                  substituem as simuladas desses sensores (ver dados/leiturasDoMarketplace.js)
//   incorporado    modo para embutir numa página com rolagem: sem zoom pela roda do mouse
//                  (botões + e −) e com rolagem vertical liberada no toque
export function FazendaInteligente({ intervaloMs = 1500, leiturasReais = null, incorporado = false, titulo = "Fazenda Inteligente", className = "" }) {
    const simuladas = useLeiturasSimuladas(SENSORES, intervaloMs);
    const [selecionado, setSelecionado] = useState(null);
    const [emFoco, setEmFoco] = useState(null);
    const [zoomFator, setZoomFator] = useState(1);

    const leituras = useMemo(() => {
        const todas = {};
        for (const sensor of SENSORES) {
            todas[sensor.id] = leiturasReais?.[sensor.id] ?? { ...simuladas[sensor.id], origem: "simulado" };
        }
        return todas;
    }, [simuladas, leiturasReais]);

    const status = useMemo(
        () => Object.fromEntries(SENSORES.map((s) => [s.id, statusDoSensor(s, leituras[s.id])])),
        [leituras]
    );

    const alterarFoco = useCallback((id, ativo) => {
        setEmFoco((atual) => (ativo ? id : atual === id ? null : atual));
    }, []);

    const alternarSelecao = useCallback((id) => {
        setSelecionado((atual) => (atual === id ? null : id));
    }, []);

    const ajustarZoom = (fator) => setZoomFator((atual) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, atual * fator)));

    return (
        <div className={`fazenda-3d ${incorporado ? "incorporado" : ""} ${className}`}>
            <Canvas shadows dpr={[1, 2]} onPointerMissed={() => setSelecionado(null)}>
                <Suspense fallback={null}>
                    <Cena
                        leituras={leituras}
                        status={status}
                        selecionado={selecionado}
                        emFoco={emFoco}
                        onFoco={alterarFoco}
                        onSelecionar={alternarSelecao}
                        zoomPelaRoda={!incorporado}
                        zoomFator={zoomFator}
                    />
                </Suspense>
            </Canvas>

            <Legenda
                titulo={titulo}
                leituras={leituras}
                status={status}
                selecionado={selecionado}
                onSelecionar={alternarSelecao}
                comDadosReais={Boolean(leiturasReais)}
                incorporado={incorporado}
            />

            {incorporado && (
                <div className="fazenda-zoom" role="group" aria-label="Zoom da cena">
                    <button type="button" onClick={() => ajustarZoom(1.25)} aria-label="Aproximar" disabled={zoomFator >= ZOOM_MAX}>+</button>
                    <button type="button" onClick={() => ajustarZoom(0.8)} aria-label="Afastar" disabled={zoomFator <= ZOOM_MIN}>−</button>
                </div>
            )}

            <p className="fazenda-dica">
                {incorporado
                    ? "Passe o mouse ou toque nos marcadores · arraste para girar · + e − para aproximar"
                    : "Passe o mouse ou clique nos marcadores · arraste para girar · role para aproximar"}
            </p>
        </div>
    );
}
