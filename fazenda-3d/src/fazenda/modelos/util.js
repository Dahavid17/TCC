import * as THREE from "three";

// Gerador pseudoaleatório com semente: a fazenda sai igual a cada carregamento.
export function aleatorio(semente) {
    let a = semente >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Pontos (plano XZ) de um retângulo com cantos arredondados, no sentido anti-horário.
export function retanguloArredondado(x0, z0, x1, z1, raio, pontosPorCanto = 6) {
    const cantos = [
        [x1 - raio, z1 - raio, 0],
        [x0 + raio, z1 - raio, Math.PI / 2],
        [x0 + raio, z0 + raio, Math.PI],
        [x1 - raio, z0 + raio, -Math.PI / 2],
    ];
    const pontos = [];

    for (const [cx, cz, inicio] of cantos) {
        for (let i = 0; i <= pontosPorCanto; i++) {
            const angulo = inicio + (i / pontosPorCanto) * (Math.PI / 2);
            pontos.push(new THREE.Vector3(cx + Math.cos(angulo) * raio, 0, cz + Math.sin(angulo) * raio));
        }
    }

    return pontos;
}
