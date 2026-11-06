import { memo, useMemo } from "react";
import * as THREE from "three";
import { CORES } from "./materiais";
import { aleatorio } from "./util";

// Estufa com teto em arco, paredes translúcidas, duas bancadas e vasos.
// Para usar seu modelo: const { scene } = useGLTF("/modelos/estufa.glb"); return <primitive object={scene} />;
// Mantenha a estufa centrada em ESTUFA (os sensores dela usam coordenadas da cena).
export const ESTUFA = { x: 6, z: -4 };
const COMPRIMENTO = 7; // eixo X
const LARGURA = 5; // eixo Z
const ALTURA = 2.2; // altura das paredes (o arco começa aqui)
const RAIO = LARGURA / 2;
const ARCOS_X = [-3.5, -1.75, 0, 1.75, 3.5];
const BANCADAS_Z = [-1.2, 1.2];
const VASOS_X = Array.from({ length: 8 }, (_, i) => -2.6 + i * 0.75);

function Vidro() {
    return (
        <meshPhysicalMaterial
            color={CORES.vidro}
            transparent
            opacity={0.28}
            roughness={0.08}
            metalness={0}
            side={THREE.DoubleSide}
            depthWrite={false}
        />
    );
}

function Estrutura({ children, ...props }) {
    return (
        <mesh castShadow {...props}>
            {children}
            <meshStandardMaterial color={CORES.estrutura} flatShading />
        </mesh>
    );
}

export const Estufa = memo(function Estufa() {
    const plantas = useMemo(() => {
        const rnd = aleatorio(7);
        return BANCADAS_Z.flatMap((z) =>
            VASOS_X.map((x) => ({ x, z, escala: 0.8 + rnd() * 0.4, tipo: rnd() > 0.5 ? "folha" : "broto" }))
        );
    }, []);

    return (
        <group position={[ESTUFA.x, 0, ESTUFA.z]}>
            {/* Piso */}
            <mesh position={[0, 0.06, 0]} receiveShadow>
                <boxGeometry args={[COMPRIMENTO + 0.3, 0.12, LARGURA + 0.3]} />
                <meshStandardMaterial color={CORES.concreto} flatShading />
            </mesh>

            {/* Bancadas */}
            {BANCADAS_Z.map((z) => (
                <group key={z} position={[0, 0, z]}>
                    <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
                        <boxGeometry args={[5.9, 0.08, 0.9]} />
                        <meshStandardMaterial color={CORES.bancada} flatShading />
                    </mesh>
                    {[-2.8, 2.8].flatMap((x) =>
                        [-0.35, 0.35].map((dz) => (
                            <mesh key={`${x}${dz}`} position={[x, 0.4, dz]}>
                                <boxGeometry args={[0.08, 0.8, 0.08]} />
                                <meshStandardMaterial color={CORES.metal} />
                            </mesh>
                        ))
                    )}
                </group>
            ))}

            {/* Vasos e plantas */}
            {plantas.map((p, i) => (
                <group key={i} position={[p.x, 0.84, p.z]}>
                    <mesh position={[0, 0.13, 0]} castShadow>
                        <cylinderGeometry args={[0.17, 0.13, 0.26, 7]} />
                        <meshStandardMaterial color={CORES.vaso} flatShading />
                    </mesh>
                    <mesh position={[0, 0.42, 0]} scale={p.escala} castShadow>
                        {p.tipo === "folha" ? <icosahedronGeometry args={[0.22, 0]} /> : <coneGeometry args={[0.2, 0.5, 5]} />}
                        <meshStandardMaterial color={p.tipo === "folha" ? CORES.folhaClara : CORES.folha} flatShading />
                    </mesh>
                </group>
            ))}

            {/* Luzes de cultivo penduradas */}
            {BANCADAS_Z.map((z) => (
                <mesh key={z} position={[0, ALTURA + 0.15, z]}>
                    <boxGeometry args={[5.4, 0.06, 0.18]} />
                    <meshStandardMaterial color={CORES.luzCultivo} emissive={CORES.luzCultivo} emissiveIntensity={0.9} />
                </mesh>
            ))}

            {/* Estrutura: pilares, vigas e arcos */}
            {ARCOS_X.flatMap((x) =>
                [-RAIO, RAIO].map((z) => (
                    <Estrutura key={`p${x}${z}`} position={[x, ALTURA / 2, z]}>
                        <boxGeometry args={[0.08, ALTURA, 0.08]} />
                    </Estrutura>
                ))
            )}
            {[-RAIO, RAIO].map((z) => (
                <Estrutura key={`v${z}`} position={[0, ALTURA, z]}>
                    <boxGeometry args={[COMPRIMENTO, 0.08, 0.08]} />
                </Estrutura>
            ))}
            <Estrutura position={[0, ALTURA + RAIO, 0]}>
                <boxGeometry args={[COMPRIMENTO, 0.08, 0.08]} />
            </Estrutura>
            {ARCOS_X.map((x) => (
                <Estrutura key={`a${x}`} position={[x, ALTURA, 0]} rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[RAIO, 0.045, 4, 8, Math.PI]} />
                </Estrutura>
            ))}

            {/* Vidro: paredes laterais, fundos e teto em arco (8 faces, visual low-poly) */}
            {[-RAIO, RAIO].map((z) => (
                <mesh key={`pl${z}`} position={[0, ALTURA / 2, z]}>
                    <boxGeometry args={[COMPRIMENTO, ALTURA, 0.03]} />
                    <Vidro />
                </mesh>
            ))}
            {[-COMPRIMENTO / 2, COMPRIMENTO / 2].map((x) => (
                <group key={`f${x}`} position={[x, 0, 0]}>
                    <mesh position={[0, ALTURA / 2, 0]}>
                        <boxGeometry args={[0.03, ALTURA, LARGURA]} />
                        <Vidro />
                    </mesh>
                    <mesh position={[0, ALTURA, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <circleGeometry args={[RAIO, 8, 0, Math.PI]} />
                        <Vidro />
                    </mesh>
                </group>
            ))}
            <mesh position={[0, ALTURA, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[RAIO, RAIO, COMPRIMENTO, 8, 1, true, 0, Math.PI]} />
                <Vidro />
            </mesh>

            {/* Porta na face +X (a que fica de frente para a câmera) */}
            <group position={[COMPRIMENTO / 2 + 0.02, 0, 0]}>
                <Estrutura position={[0, 0.95, -0.55]}>
                    <boxGeometry args={[0.06, 1.9, 0.08]} />
                </Estrutura>
                <Estrutura position={[0, 0.95, 0.55]}>
                    <boxGeometry args={[0.06, 1.9, 0.08]} />
                </Estrutura>
                <Estrutura position={[0, 1.9, 0]}>
                    <boxGeometry args={[0.06, 0.08, 1.18]} />
                </Estrutura>
            </group>
        </group>
    );
});
