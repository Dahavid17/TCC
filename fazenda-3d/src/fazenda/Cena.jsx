import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { GRUPOS, SENSORES } from "./dados/sensores";
import { Terreno } from "./modelos/Terreno";
import { Plantacao } from "./modelos/Plantacao";
import { Estufa } from "./modelos/Estufa";
import { Trator, Trilha, criarCurvaTrilha } from "./modelos/Trator";
import { Decoracao } from "./modelos/Decoracao";
import { MarcadorSensor } from "./sensores/MarcadorSensor";

const SENSORES_FIXOS = SENSORES.filter((s) => s.ancora !== "trator");
const SENSORES_TRATOR = SENSORES.filter((s) => s.ancora === "trator");

// Câmera ortográfica em ângulo isométrico; o zoom inicial se ajusta ao tamanho do canvas.
// Em telas largas o centro da vista anda para (-x, +z), o que empurra a fazenda para a
// direita na tela e libera o espaço da legenda.
function CameraIsometrica({ alvo, fator }) {
    const { size } = useThree();
    const zoom = Math.max(9, Math.min(size.width / 36, size.height / 27)) * fator;

    return (
        <OrthographicCamera
            makeDefault
            position={[alvo[0] + 20, 18, alvo[2] + 20]}
            zoom={zoom}
            near={0.1}
            far={200}
        />
    );
}

function Luzes() {
    return (
        <>
            <hemisphereLight args={["#fffbea", "#6f8f4e", 1.5]} />
            <directionalLight
                position={[12, 20, 9]}
                intensity={2.4}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0004}
                shadow-camera-left={-18}
                shadow-camera-right={18}
                shadow-camera-top={18}
                shadow-camera-bottom={-18}
                shadow-camera-near={1}
                shadow-camera-far={60}
            />
        </>
    );
}

export function Cena({ leituras, status, selecionado, emFoco, onFoco, onSelecionar, zoomPelaRoda = true, zoomFator = 1 }) {
    const curva = useMemo(criarCurvaTrilha, []);
    const telaLarga = useThree((state) => state.size.width > 900);
    const alvo = useMemo(() => (telaLarga ? [-2.2, 0, 2.2] : [0, 0, 0]), [telaLarga]);
    const cargaAtual = leituras["trator-carga"]?.campos.carga?.valor ?? 50;
    const tratorEmFoco = SENSORES_TRATOR.some((s) => s.id === emFoco || s.id === selecionado);

    const marcador = (sensor) => (
        <MarcadorSensor
            key={sensor.id}
            sensor={sensor}
            grupo={GRUPOS[sensor.grupo]}
            leitura={leituras[sensor.id]}
            status={status[sensor.id]}
            ativo={emFoco === sensor.id || selecionado === sensor.id}
            fixo={selecionado === sensor.id}
            onFoco={onFoco}
            onSelecionar={onSelecionar}
        />
    );

    return (
        <>
            <CameraIsometrica alvo={alvo} fator={zoomFator} />
            <OrbitControls
                makeDefault
                target={alvo}
                enablePan={false}
                enableZoom={zoomPelaRoda}
                enableDamping
                minZoom={12}
                maxZoom={120}
                minPolarAngle={0.45}
                maxPolarAngle={1.2}
            />
            <Luzes />

            <Terreno />
            <Plantacao />
            <Estufa />
            <Decoracao />
            <Trilha curva={curva} />

            {/* O trator para enquanto você olha um sensor dele, para facilitar a leitura. */}
            <Trator curva={curva} carga={cargaAtual} pausado={tratorEmFoco}>
                {SENSORES_TRATOR.map(marcador)}
            </Trator>

            {SENSORES_FIXOS.map(marcador)}
        </>
    );
}
