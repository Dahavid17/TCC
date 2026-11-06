import { memo } from "react";
import { CORES } from "./materiais";

// "Ilha" de terreno: gramado por cima e camadas de terra nas laterais.
// Para usar seu modelo: const { scene } = useGLTF("/modelos/terreno.glb"); return <primitive object={scene} />;
export const LARGURA = 26;
export const PROFUNDIDADE = 24;

export const Terreno = memo(function Terreno() {
    return (
        <group>
            <mesh position={[0, -0.06, 0]} receiveShadow>
                <boxGeometry args={[LARGURA, 0.12, PROFUNDIDADE]} />
                <meshStandardMaterial color={CORES.grama} flatShading />
            </mesh>
            <mesh position={[0, -0.7, 0]}>
                <boxGeometry args={[LARGURA - 0.1, 1.2, PROFUNDIDADE - 0.1]} />
                <meshStandardMaterial color={CORES.terraLateral} flatShading />
            </mesh>
            <mesh position={[0, -1.6, 0]}>
                <boxGeometry args={[LARGURA - 0.6, 0.6, PROFUNDIDADE - 0.6]} />
                <meshStandardMaterial color={CORES.terraEscura} flatShading />
            </mesh>
        </group>
    );
});
