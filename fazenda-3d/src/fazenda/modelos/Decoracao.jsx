import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CORES } from "./materiais";

// Elementos de ambientação. Nenhum tem sensor: podem ser trocados ou removidos à vontade.
const ARVORES = [
    [-11.6, 10.4, 1.1], [-8.2, 10.6, 0.9], [-4.5, 10.3, 1.2], [-0.8, 10.6, 0.85],
    [3.2, 10.5, 1.05], [11.6, 10.2, 1.2], [11.8, 6.2, 0.9], [12, 0.2, 1.1],
    [11.8, -7.8, 1.0], [8.6, -10.6, 0.95], [1.8, -10.4, 1.15], [-6.5, -10.6, 0.9], [-11.8, -10.2, 1.1],
];
const PEDRAS = [[9.6, 8.6, 0.5], [-1.2, -9.6, 0.4], [2.8, 9.2, 0.35], [12.1, -3.5, 0.45], [-12.5, 4, 0.4]];
const FENOS = [[3.4, 0.6], [4.4, 1.0], [3.7, 1.7]];

export const Decoracao = memo(function Decoracao() {
    return (
        <group>
            {ARVORES.map(([x, z, escala], i) => (
                <Arvore key={i} position={[x, 0, z]} escala={escala} variante={i % 2} />
            ))}
            {PEDRAS.map(([x, z, escala], i) => (
                <mesh key={i} position={[x, escala * 0.35, z]} scale={[escala, escala * 0.7, escala]} rotation={[0, i, 0]} castShadow>
                    <dodecahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color={CORES.pedra} flatShading />
                </mesh>
            ))}
            {FENOS.map(([x, z], i) => (
                <mesh key={i} position={[x, 0.32, z]} rotation={[0, i * 0.7, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.32, 0.32, 0.6, 8]} />
                    <meshStandardMaterial color={CORES.feno} flatShading />
                </mesh>
            ))}
            <Lago />
            <Gateway position={[4.2, 0, 5.2]} />
        </group>
    );
});

function Arvore({ escala, variante, ...props }) {
    return (
        <group {...props} scale={escala}>
            <mesh position={[0, 0.45, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.16, 0.9, 6]} />
                <meshStandardMaterial color={CORES.tronco} flatShading />
            </mesh>
            {variante === 0 ? (
                <>
                    <mesh position={[0, 1.25, 0]} castShadow>
                        <coneGeometry args={[0.75, 1.2, 6]} />
                        <meshStandardMaterial color={CORES.copa} flatShading />
                    </mesh>
                    <mesh position={[0, 1.8, 0]} castShadow>
                        <coneGeometry args={[0.55, 0.9, 6]} />
                        <meshStandardMaterial color={CORES.copaClara} flatShading />
                    </mesh>
                </>
            ) : (
                <mesh position={[0, 1.35, 0]} castShadow>
                    <icosahedronGeometry args={[0.75, 0]} />
                    <meshStandardMaterial color={CORES.copaClara} flatShading />
                </mesh>
            )}
        </group>
    );
}

function Lago() {
    return (
        <group position={[8, 0, 5.4]}>
            <mesh position={[0, 0.01, 0]} receiveShadow>
                <cylinderGeometry args={[2.25, 2.25, 0.04, 9]} />
                <meshStandardMaterial color={CORES.estrada} flatShading />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
                <cylinderGeometry args={[1.95, 1.95, 0.04, 9]} />
                <meshStandardMaterial color={CORES.agua} roughness={0.2} flatShading />
            </mesh>
        </group>
    );
}

// Torre do gateway IoT (recebe os dados dos ESP32): luz piscando e ondas de sinal.
function Gateway(props) {
    const luz = useRef();
    const ondas = useRef([]);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        luz.current.material.emissiveIntensity = 0.4 + (Math.sin(t * 4) > 0 ? 1.4 : 0);
        ondas.current.forEach((onda, i) => {
            if (!onda) return;
            const fase = (t * 0.5 + i / 3) % 1;
            onda.scale.setScalar(0.4 + fase * 2.2);
            onda.material.opacity = 0.45 * (1 - fase);
        });
    });

    return (
        <group {...props}>
            <mesh position={[0, 1.4, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.1, 2.8, 6]} />
                <meshStandardMaterial color={CORES.metal} flatShading />
            </mesh>
            <mesh position={[0, 1.6, 0.12]} castShadow>
                <boxGeometry args={[0.35, 0.45, 0.14]} />
                <meshStandardMaterial color={CORES.estrutura} flatShading />
            </mesh>
            <mesh ref={luz} position={[0, 2.9, 0]}>
                <icosahedronGeometry args={[0.12, 0]} />
                <meshStandardMaterial color="#7cf29a" emissive="#3ee07a" emissiveIntensity={1} />
            </mesh>
            {[0, 1, 2].map((i) => (
                <mesh key={i} ref={(el) => (ondas.current[i] = el)} position={[0, 2.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.3, 0.36, 24]} />
                    <meshBasicMaterial color="#3ee07a" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
            ))}
        </group>
    );
}
