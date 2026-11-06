# Fazenda Inteligente 3D

Cena isométrica low-poly (React + `@react-three/fiber` + `@react-three/drei`) para demonstrar o
monitoramento de sensores do Marketplace Rural. Passe o mouse sobre um marcador para ver o painel
com a leitura ao vivo; clique para fixá-lo. A lista lateral faz o mesmo (e funciona pelo teclado).

```bash
npm install
npm run dev      # http://localhost:5179
npm run build    # gera dist/ (base "./": pode ser publicado em qualquer subpasta)
```

## Na aba Gestão da Fazenda (widget)

```bash
npm run build:widget   # gera ../frontend/vendor/fazenda-3d/fazenda-3d.js e .css
```

A página `frontend/pages/gestao-fazenda.html` carrega esse pacote só quando a seção
"Fazenda em 3D" chega perto da tela e chama:

```js
const cena = window.FazendaInteligente3D.montar(elemento, { sensoresReais: dados.sensores });
cena.atualizar(dados.sensores); // a cada resposta de backend/gestao/resumo.php
```

`dados/leiturasDoMarketplace.js` converte os sensores do ESP32 (umidade_solo, temperatura,
umidade_ar, luminosidade) nos marcadores da cena; os demais seguem simulados e aparecem com a
etiqueta "Simulado". No modo incorporado a roda do mouse rola a página (o zoom fica nos botões
+ e −) e, no toque, arrastar na vertical rola a página. Depois de mudar a cena, rode
`npm run build:widget` e suba `VERSAO_CENA_3D` em `frontend/js/gestao-fazenda.js`.

## Estrutura

```text
src/
├── App.jsx                      exemplo de uso (tela inteira)
└── fazenda/
    ├── index.js                 exporta FazendaInteligente, SENSORES, GRUPOS e o hook
    ├── FazendaInteligente.jsx   Canvas + estado (sensor em foco/fixo) + legenda
    ├── Cena.jsx                 câmera isométrica, luzes, modelos e marcadores
    ├── Legenda.jsx              lista lateral com todos os sensores
    ├── fazenda.css              legenda e painéis HTML
    ├── dados/
    │   ├── sensores.js          catálogo: grupos, posições, unidades, faixas ideais
    │   ├── useLeiturasSimuladas.js  leituras "ao vivo" simuladas (com histórico)
    │   └── status.js            normal / atenção / crítico e formatação pt-BR
    ├── sensores/
    │   ├── MarcadorSensor.jsx   pino + cabeça pulsante + onda + área de clique
    │   └── PainelSensor.jsx     painel sobreposto (valor, gráfico, faixa ideal, NPK em barras)
    └── modelos/                 placeholders com formas básicas
        ├── Terreno.jsx  Plantacao.jsx  Estufa.jsx  Trator.jsx  Decoracao.jsx
        ├── materiais.js         paleta de cores
        └── util.js
```

## Sensores

| Grupo | Sensores |
| --- | --- |
| Plantação | Umidade do solo · Temperatura da terra · NPK (N, P e K em barras) |
| Estufa | Temperatura ambiente · Umidade do ar · Luminosidade (lx) · CO₂ |
| Maquinário (anda com o trator) | Telemetria/GPS · Combustível · Motor (rpm, temperatura, óleo) · Carga |

O marcador assume a cor do grupo quando tudo está na faixa ideal, fica amarelo em **atenção**
e vermelho em **crítico**. A altura dos grãos na carreta acompanha o sensor de carga, e o trator
para enquanto um sensor dele está em foco.

## Trocar os placeholders por modelos .gltf/.glb

Coloque os arquivos em `public/modelos/` e substitua o conteúdo do componente. Ex.: em `Estufa.jsx`

```jsx
import { useGLTF } from "@react-three/drei";

export function Estufa() {
    const { scene } = useGLTF("/modelos/estufa.glb");
    return <primitive object={scene} position={[ESTUFA.x, 0, ESTUFA.z]} />;
}
useGLTF.preload("/modelos/estufa.glb");
```

Os sensores não dependem dos modelos: ajuste `posicao` (e `haste`) em `dados/sensores.js` para
encaixar os pinos no seu modelo. No trator, troque o conteúdo de `ModeloTrator` e mantenha o
`<group>` que se move (os marcadores com `ancora: "trator"` são filhos dele). Os modelos já ficam
dentro de `<Suspense>`, então o carregamento assíncrono funciona sem mudanças.

## Ligar a dados reais

`useLeiturasSimuladas` devolve `{ [sensorId]: { atualizadoEm, campos: { [chave]: { valor, historico } } } }`.
Escreva um hook com a mesma saída e troque a linha indicada em `FazendaInteligente.jsx`. Exemplo
usando a rota do marketplace (`backend/gestao/resumo.php`, que já devolve leituras e histórico do ESP32):

```js
// tipos do ESP32 -> sensores da cena
const MAPA = {
    umidade_solo: ["solo-umidade", "umidade"],
    temperatura: ["estufa-temperatura", "temperatura"],
    umidade_ar: ["estufa-umidade", "umidade"],
    luminosidade: ["estufa-luminosidade", "lux"],
};
// para cada sensor do resumo: leituras[id].campos[chave] = { valor: s.valor, historico: s.historico }
```

Sensores sem correspondente real podem continuar simulados (mescle os dois objetos).
