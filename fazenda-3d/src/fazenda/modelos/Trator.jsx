import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CORES } from "./materiais";
import { retanguloArredondado } from "./util";

// Trator com carreta graneleira que contorna a plantação por uma trilha de terra.
// O trator olha para +Z no espaço local; os filhos (marcadores dos sensores) andam junto.
// Para usar seu modelo: troque o conteúdo de <ModeloTrator /> por
//   const { scene } = useGLTF("/modelos/trator.glb"); return <primitive object={scene} />;
// e ajuste as posições dos sensores com ancora "trator" em dados/sensores.js.

const VELOCIDADE = 1.7; // unidades da cena por segundo

export function criarCurvaTrilha() {
    const pontos = retanguloArredondado(-11, -7.6, 0.4, 7.6, 2.4, 6);
    return new THREE.CatmullRomCurve3(pontos, true, "centripetal");
}

// Trilha: um tubo achatado seguindo a mesma curva do trator.
export const Trilha = memo(function Trilha({ curva }) {
    const geometria = useMemo(() => new THREE.TubeGeometry(curva, 260, 0.9, 8, true), [curva]);

    return (
        <mesh geometry={geometria} position={[0, 0.012, 0]} scale={[1, 0.02, 1]} receiveShadow>
            <meshStandardMaterial color={CORES.estrada} flatShading />
        </mesh>
    );
});

export function Trator({ curva, carga = 50, pausado = false, children }) {
    const raiz = useRef();
    const rodas = useRef([]);
    const fumaca = useRef([]);
    const progresso = useRef(0.35);
    const ritmo = useRef(1); // 1 = andando, 0 = parado (desacelera suavemente)
    const tangente = useMemo(() => new THREE.Vector3(), []);
    const comprimento = useMemo(() => curva.getLength(), [curva]);

    useFrame(({ clock }, delta) => {
        const dt = Math.min(delta, 0.1);
        ritmo.current += ((pausado ? 0 : 1) - ritmo.current) * Math.min(1, dt * 3);
        const deslocamento = dt * VELOCIDADE * ritmo.current;

        progresso.current = (progresso.current + deslocamento / comprimento) % 1;
        const ponto = curva.getPointAt(progresso.current);
        curva.getTangentAt(progresso.current, tangente);

        raiz.current.position.set(ponto.x, 0, ponto.z);
        raiz.current.rotation.y = Math.atan2(tangente.x, tangente.z);

        for (const roda of rodas.current) {
            if (roda) roda.rotation.x += deslocamento / roda.userData.raio;
        }

        fumaca.current.forEach((nuvem, i) => {
            if (!nuvem) return;
            const fase = (clock.elapsedTime * 0.7 + i / fumaca.current.length) % 1;
            nuvem.position.set(0.3, 1.75 + fase * 1.1, 0.85 - fase * 0.5);
            nuvem.scale.setScalar(0.08 + fase * 0.22);
            nuvem.material.opacity = 0.5 * (1 - fase) * (0.3 + 0.7 * ritmo.current);
        });
    });

    const registrarRoda = (indice, raio) => (el) => {
        if (el) {
            el.userData.raio = raio;
            rodas.current[indice] = el;
        }
    };

    return (
        <group ref={raiz}>
            <ModeloTrator carga={carga} registrarRoda={registrarRoda} />

            {[0, 1, 2].map((i) => (
                <mesh key={i} ref={(el) => (fumaca.current[i] = el)}>
                    <icosahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color="#e8ecee" transparent opacity={0.4} depthWrite={false} flatShading />
                </mesh>
            ))}

            {children}
        </group>
    );
}

function Peca({ cor, children, ...props }) {
    return (
        <mesh castShadow receiveShadow {...props}>
            {children}
            <meshStandardMaterial color={cor} flatShading />
        </mesh>
    );
}

function Roda({ raio, largura, registrar, ...props }) {
    return (
        <group {...props}>
            <group ref={registrar}>
                <Peca cor={CORES.pneu} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[raio, raio, largura, 10]} />
                </Peca>
                <Peca cor={CORES.aro} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[raio * 0.5, raio * 0.5, largura + 0.02, 6]} />
                </Peca>
            </group>
        </group>
    );
}

function ModeloTrator({ carga, registrarRoda }) {
    const alturaCarga = 0.05 + 0.42 * Math.min(1, Math.max(0, carga / 100));

    return (
        <group>
            {/* Chassi, capô e grade */}
            <Peca cor={CORES.tratorEscuro} position={[0, 0.55, 0.05]}>
                <boxGeometry args={[0.85, 0.32, 2.3]} />
            </Peca>
            <Peca cor={CORES.trator} position={[0, 0.95, 0.55]}>
                <boxGeometry args={[0.82, 0.55, 1.1]} />
            </Peca>
            <Peca cor={CORES.metal} position={[0, 0.9, 1.11]}>
                <boxGeometry args={[0.66, 0.42, 0.04]} />
            </Peca>

            {/* Cabine */}
            <Peca cor={CORES.cabine} position={[0, 1.5, -0.45]}>
                <boxGeometry args={[1.0, 0.95, 0.95]} />
            </Peca>
            <Peca cor={CORES.janela} position={[0, 1.6, -0.45]}>
                <boxGeometry args={[1.02, 0.5, 0.72]} />
            </Peca>
            <Peca cor={CORES.janela} position={[0, 1.6, 0.03]}>
                <boxGeometry args={[0.78, 0.5, 0.02]} />
            </Peca>
            <Peca cor={CORES.trator} position={[0, 2.02, -0.45]}>
                <boxGeometry args={[1.15, 0.1, 1.1]} />
            </Peca>

            {/* Escapamento e tanque */}
            <Peca cor={CORES.metal} position={[0.3, 1.45, 0.85]}>
                <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
            </Peca>
            <Peca cor={CORES.metal} position={[0.52, 0.78, 0.25]}>
                <boxGeometry args={[0.22, 0.3, 0.45]} />
            </Peca>

            {/* Rodas */}
            <Roda raio={0.55} largura={0.34} position={[-0.62, 0.55, -0.45]} registrar={registrarRoda(0, 0.55)} />
            <Roda raio={0.55} largura={0.34} position={[0.62, 0.55, -0.45]} registrar={registrarRoda(1, 0.55)} />
            <Roda raio={0.32} largura={0.24} position={[-0.5, 0.32, 0.85]} registrar={registrarRoda(2, 0.32)} />
            <Roda raio={0.32} largura={0.24} position={[0.5, 0.32, 0.85]} registrar={registrarRoda(3, 0.32)} />

            {/* Engate e carreta */}
            <Peca cor={CORES.metal} position={[0, 0.42, -1.35]}>
                <boxGeometry args={[0.1, 0.1, 0.6]} />
            </Peca>
            <group position={[0, 0, -2.45]}>
                <Peca cor={CORES.carreta} position={[0, 0.62, 0]}>
                    <boxGeometry args={[1.3, 0.12, 1.7]} />
                </Peca>
                {[-0.62, 0.62].map((x) => (
                    <Peca key={x} cor={CORES.carreta} position={[x, 0.9, 0]}>
                        <boxGeometry args={[0.06, 0.45, 1.7]} />
                    </Peca>
                ))}
                {[-0.82, 0.82].map((z) => (
                    <Peca key={z} cor={CORES.carreta} position={[0, 0.9, z]}>
                        <boxGeometry args={[1.3, 0.45, 0.06]} />
                    </Peca>
                ))}
                {/* A altura dos grãos acompanha o sensor de carga */}
                <Peca cor={CORES.carga} position={[0, 0.68 + alturaCarga / 2, 0]}>
                    <boxGeometry args={[1.16, alturaCarga, 1.56]} />
                </Peca>
                <Roda raio={0.3} largura={0.2} position={[-0.75, 0.3, 0]} registrar={registrarRoda(4, 0.3)} />
                <Roda raio={0.3} largura={0.2} position={[0.75, 0.3, 0]} registrar={registrarRoda(5, 0.3)} />
            </group>
        </group>
    );
}
