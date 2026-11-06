import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { COR_STATUS } from "../dados/status";
import { PainelSensor } from "./PainelSensor";

// Marcador de sensor: haste + cabeça brilhante que pulsa + onda que se expande.
// Passar o mouse mostra o painel; clicar fixa o painel (clicar de novo ou no "×" solta).
export function MarcadorSensor({ sensor, grupo, leitura, status, ativo, fixo, onFoco, onSelecionar }) {
    const cabeca = useRef();
    const onda = useRef();
    const flutuacao = useRef();
    const haste = sensor.haste ?? 0.85;
    const fase = useMemo(() => Math.random() * Math.PI * 2, []);
    const reduzirMovimento = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
    const cor = status === "normal" ? grupo.cor : COR_STATUS[status];

    // Ao desmontar com o mouse em cima, devolve o cursor ao normal.
    useEffect(() => () => { document.body.style.cursor = ""; }, []);

    useFrame(({ clock }) => {
        // Com "reduzir movimento" no sistema, o marcador fica parado (só o destaque muda).
        const t = reduzirMovimento ? 0.6 : clock.elapsedTime + fase;
        const destaque = ativo ? 1.35 : 1;
        const pulso = 1 + Math.sin(t * 3) * 0.1;

        cabeca.current.scale.setScalar(destaque * pulso);
        cabeca.current.material.emissiveIntensity = (ativo ? 1.1 : 0.55) + Math.sin(t * 3) * 0.3;

        const ciclo = (t % 1.8) / 1.8;
        onda.current.scale.setScalar(0.7 + ciclo * 1.7);
        onda.current.material.opacity = (1 - ciclo) * (status === "normal" ? 0.5 : 0.8);

        flutuacao.current.position.y = Math.sin(t * 1.6) * 0.05;
    });

    const entrar = (e) => {
        e.stopPropagation();
        onFoco(sensor.id, true);
        document.body.style.cursor = "pointer";
    };

    const sair = () => {
        onFoco(sensor.id, false);
        document.body.style.cursor = "";
    };

    const clicar = (e) => {
        e.stopPropagation();
        onSelecionar(sensor.id);
    };

    return (
        <group position={sensor.posicao}>
            {/* Haste espetada no solo/vaso/máquina */}
            <mesh position={[0, haste / 2, 0]}>
                <cylinderGeometry args={[0.025, 0.025, haste, 6]} />
                <meshStandardMaterial color="#eef2f3" />
            </mesh>
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.12, 12]} />
                <meshBasicMaterial color={cor} transparent opacity={0.45} depthWrite={false} />
            </mesh>

            <group position={[0, haste + 0.22, 0]}>
                <group ref={flutuacao}>
                    <mesh ref={cabeca} castShadow>
                        <icosahedronGeometry args={[0.22, 0]} />
                        <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={0.6} flatShading />
                    </mesh>

                    <Billboard>
                        <mesh ref={onda}>
                            <ringGeometry args={[0.26, 0.33, 28]} />
                            <meshBasicMaterial color={cor} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
                        </mesh>
                    </Billboard>

                    {/* Área de hover/clique bem maior que o desenho, invisível (facilita no celular e com zoom baixo) */}
                    <mesh onPointerOver={entrar} onPointerOut={sair} onClick={clicar}>
                        <sphereGeometry args={[0.62, 10, 8]} />
                        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                    </mesh>

                    {ativo && (
                        <Html position={[0, 0.32, 0]} zIndexRange={[40, 10]} pointerEvents={fixo ? "auto" : "none"}>
                            <PainelSensor
                                sensor={sensor}
                                grupo={grupo}
                                leitura={leitura}
                                status={status}
                                fixo={fixo}
                                onFechar={() => onSelecionar(sensor.id)}
                            />
                        </Html>
                    )}
                </group>
            </group>
        </group>
    );
}
