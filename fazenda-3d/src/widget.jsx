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

function CenaDoMarketplace({ loja, titulo }) {
    const sensores = useSyncExternalStore(loja.assinar, loja.ler);
    const leiturasReais = useMemo(() => leiturasDoResumo(sensores), [sensores]);

    return <FazendaInteligente leiturasReais={leiturasReais} incorporado titulo={titulo} />;
}

function montar(elemento, { sensoresReais = [], titulo = "Fazenda em 3D" } = {}) {
    const loja = criarLoja(sensoresReais);
    const raiz = createRoot(elemento);

    raiz.render(
        <StrictMode>
            <CenaDoMarketplace loja={loja} titulo={titulo} />
        </StrictMode>
    );

    return {
        atualizar: (sensores) => loja.escrever(Array.isArray(sensores) ? sensores : []),
        desmontar: () => raiz.unmount(),
    };
}

window.FazendaInteligente3D = { montar };
