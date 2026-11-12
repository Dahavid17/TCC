import { StrictMode, useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { FazendaInteligente } from "./fazenda/FazendaInteligente";
import { leiturasDoResumo } from "./fazenda/dados/leiturasDoMarketplace";

// Entrada do pacote para páginas sem React (ex.: Gestão da Fazenda do Marketplace).
// Gera frontend/vendor/fazenda-3d/fazenda-3d.js + .css com `npm run build:widget`.
//
// Uso:
//   const cena = window.FazendaInteligente3D.montar(elemento, { sensoresReais: dados.sensores });
//   cena.atualizar(dados.sensores);   // a cada resposta de backend/gestao/resumo.php
//   cena.desmontar();

function criarLoja(inicial) {
    let valor = inicial;
    const ouvintes = new Set();

    return {
        ler: () => valor,
        escrever(novo) {
            valor = novo;
            ouvintes.forEach((avisar) => avisar());
        },
        assinar(avisar) {
            ouvintes.add(avisar);
            return () => ouvintes.delete(avisar);
        },
    };
}

//   Opções: titulo; grupos = só os sensores destes grupos ("plantacao", "estufa", "maquinario").
//   Os planos do Marketplace usam ["plantacao", "estufa"] (Essencial) e todos (Pro).
//   Sem sensoresReais (ex.: página de planos) todos os marcadores ficam simulados.
//   cena.configurar({ titulo, grupos }) troca o plano mostrado SEM recriar a cena
//   (recriar o <Canvas> pode perder o contexto WebGL em alguns navegadores).

function CenaDoMarketplace({ loja, lojaConfig }) {
    const sensores = useSyncExternalStore(loja.assinar, loja.ler);
    const { titulo, grupos } = useSyncExternalStore(lojaConfig.assinar, lojaConfig.ler);
    const leiturasReais = useMemo(() => leiturasDoResumo(sensores), [sensores]);

    return (
        <FazendaInteligente
            leiturasReais={sensores.length ? leiturasReais : null}
            grupos={grupos}
            incorporado
            titulo={titulo}
        />
    );
}

function montar(elemento, { sensoresReais = [], titulo = "Fazenda em 3D", grupos = null } = {}) {
    const loja = criarLoja(sensoresReais);
    const lojaConfig = criarLoja({ titulo, grupos });
    const raiz = createRoot(elemento);

    raiz.render(
        <StrictMode>
            <CenaDoMarketplace loja={loja} lojaConfig={lojaConfig} />
        </StrictMode>
    );

    return {
        atualizar: (sensores) => loja.escrever(Array.isArray(sensores) ? sensores : []),
        configurar: (opcoes = {}) => lojaConfig.escrever({ ...lojaConfig.ler(), ...opcoes }),
        desmontar: () => raiz.unmount(),
    };
}

window.FazendaInteligente3D = { montar };
