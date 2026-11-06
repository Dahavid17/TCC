import { memo, useMemo } from "react";
import { CORES } from "./materiais";
import { aleatorio } from "./util";

// Plantação: 6 fileiras (3 de milho, 3 de hortaliças) sobre canteiros de terra.
// Para usar seu modelo: const { scene } = useGLTF("/modelos/plantacao.glb"); return <primitive object={scene} />;
// Os sensores ficam em dados/sensores.js e não dependem deste arquivo.
export const FILEIRAS_X = Array.from({ length: 6 }, (_, i) => -9.5 + i * 1.4);
const COMPRIMENTO = 12;

export const Plantacao = memo(function Plantacao() {
    const plantas = useMemo(() => {
        const rnd = aleatorio(42);
        const lista = [];

        FILEIRAS_X.forEach((x, fileira) => {
            for (let z = -5.6; z <= 5.61; z += 0.8) {
                lista.push({
                    x: x + (rnd() - 0.5) * 0.12,
                    z: z + (rnd() - 0.5) * 0.2,
                    escala: 0.8 + rnd() * 0.45,
                    giro: rnd() * Math.PI * 2,
                    milho: fileira < 3,
                });
            }
        });

        return lista;
    }, []);

    return (
        <group>
            <mesh position={[-5.8, 0.02, 0]} receiveShadow>
                <boxGeometry args={[8.4, 0.04, 13]} />
                <meshStandardMaterial color={CORES.sulco} flatShading />
            </mesh>

            {FILEIRAS_X.map((x) => (
                <mesh key={x} position={[x, 0.14, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.9, 0.26, COMPRIMENTO]} />
                    <meshStandardMaterial color={CORES.canteiro} flatShading />
                </mesh>
            ))}

            {plantas.map((planta, i) => (
                <Planta key={i} {...planta} />
            ))}
        </group>
    );
});

function Planta({ x, z, escala, giro, milho }) {
    return (
        <group position={[x, 0.27, z]} scale={escala} rotation={[0, giro, 0]}>
            {milho ? (
                <>
                    <mesh position={[0, 0.36, 0]} castShadow>
                        <coneGeometry args={[0.2, 0.72, 5]} />
                        <meshStandardMaterial color={CORES.folha} flatShading />
                    </mesh>
                    <mesh position={[0.09, 0.4, 0]} rotation={[0, 0, -0.45]} castShadow>
                        <boxGeometry args={[0.08, 0.22, 0.08]} />
                        <meshStandardMaterial color={CORES.milho} flatShading />
                    </mesh>
                </>
            ) : (
                <mesh position={[0, 0.17, 0]} castShadow>
                    <icosahedronGeometry args={[0.23, 0]} />
                    <meshStandardMaterial color={CORES.folhaClara} flatShading />
                </mesh>
            )}
        </group>
    );
}
