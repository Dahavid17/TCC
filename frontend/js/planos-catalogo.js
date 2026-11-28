// Catálogo dos planos da Gestão da Fazenda (único lugar com nomes, preços e textos).
// Usado por planos.html (vitrine) e gestao-fazenda.html (o que cada plano libera).
// Por enquanto é DEMONSTRAÇÃO: escolher um plano não gera cobrança.
//
// recursos: o que a Gestão da Fazenda mostra para o plano
//   sensores    cards dos sensores IoT (ESP32)
//   automacao   regras automáticas (irrigação, ventilação, iluminação)
//   dashboard   painel completo com gráficos grandes em tempo real e alertas
//   maquinario  telemetria do trator (GPS, combustível, motor, carga)
//   suporte     instalação e manutenção grátis pela equipe
//   gestao      propriedades/talhões, safras, diário de campo, agenda e financeiro (gestao-rural.html)
//   gestao_pro  dashboard da gestão, documentos, silos e relatórios PDF/Excel
//               (o backend confere o plano: backend/lib/gestao.php, RECURSOS_POR_PLANO)
// grupos3d: grupos de sensores mostrados na fazenda 3D (ver fazenda-3d/src/fazenda/dados/sensores.js)

window.PLANOS_FAZENDA = {

    essencial: {
        id: "essencial",
        nome: "Plano Essencial",
        icone: "bi-flower1",
        preco: "R$ 79",
        periodo: "por mês",
        chamada: "Sensores e automação para cuidar da sua plantação e da estufa.",
        grupos3d: ["plantacao", "estufa"],
        recursos: { sensores: true, automacao: true, dashboard: false, maquinario: false, suporte: false, gestao: true, gestao_pro: false },
        itens: [
            { icone: "bi-cpu", texto: "Conexão de placas ESP32 com sensores" },
            { icone: "bi-moisture", texto: "Umidade do solo, temperatura, umidade do ar e luz" },
            { icone: "bi-droplet-half", texto: "Irrigação automática quando a terra secar" },
            { icone: "bi-fan", texto: "Ventilação e iluminação automáticas da estufa" },
            { icone: "bi-bell", texto: "Aviso na tela quando algo sair do normal" },
            { icone: "bi-map", texto: "Propriedades, talhões no mapa, safras e diário de campo" },
            { icone: "bi-calendar-check", texto: "Agenda com lembretes e controle financeiro" }
        ],
        passos: [
            { icone: "bi-box-seam", titulo: "Você recebe o kit", texto: "Uma placa ESP32 com sensores de solo, temperatura, umidade do ar e luz." },
            { icone: "bi-plug", titulo: "Liga e conecta", texto: "Você instala a placa na plantação ou na estufa e informa o código dela aqui no site." },
            { icone: "bi-broadcast", titulo: "Os sensores medem sozinhos", texto: "A cada poucos segundos a placa envia as leituras para o seu painel." },
            { icone: "bi-gear-wide-connected", titulo: "A fazenda se cuida", texto: "Se a terra secar, a irrigação liga. Se a estufa esquentar, a ventilação liga." }
        ],
        narracao: "Plano Essencial. Você recebe uma placa com sensores que medem a umidade da terra, a temperatura, a umidade do ar e a luz. As leituras aparecem no seu painel a cada poucos segundos. Quando a terra seca, a irrigação liga sozinha. Quando a estufa esquenta, a ventilação liga sozinha."
    },

    pro: {
        id: "pro",
        nome: "Plano Pro",
        icone: "bi-stars",
        preco: "R$ 149",
        periodo: "por mês",
        chamada: "Tudo do Essencial, com painel completo em tempo real e equipe técnica na sua fazenda.",
        destaque: "Mais completo",
        grupos3d: ["plantacao", "estufa", "maquinario"],
        recursos: { sensores: true, automacao: true, dashboard: true, maquinario: true, suporte: true, gestao: true, gestao_pro: true },
        itens: [
            { icone: "bi-check2-all", texto: "Tudo o que vem no Plano Essencial" },
            { icone: "bi-graph-up-arrow", texto: "Painel completo com gráficos grandes em tempo real" },
            { icone: "bi-exclamation-triangle", texto: "Histórico de alertas e médias do dia" },
            { icone: "bi-truck", texto: "Acompanhamento do trator: GPS, combustível e motor" },
            { icone: "bi-tools", texto: "Instalação e manutenção GRÁTIS pela nossa equipe" },
            { icone: "bi-speedometer2", texto: "Dashboard da gestão, documentos e silos" },
            { icone: "bi-file-earmark-bar-graph", texto: "Relatórios em PDF e Excel com um clique" }
        ],
        passos: [
            { icone: "bi-person-gear", titulo: "Nossa equipe vai até você", texto: "Os técnicos instalam as placas e os sensores na sua fazenda, sem custo." },
            { icone: "bi-broadcast", titulo: "Tudo é medido ao vivo", texto: "Solo, estufa e trator enviam as leituras em tempo real para o seu painel." },
            { icone: "bi-graph-up-arrow", titulo: "Painel completo", texto: "Gráficos grandes, médias do dia e alertas mostram tudo o que acontece." },
            { icone: "bi-tools", titulo: "Manutenção garantida", texto: "Se um sensor parar, a equipe volta para consertar ou trocar, de graça." }
        ],
        narracao: "Plano Pro. Tem tudo o que vem no Plano Essencial e mais: um painel completo, com gráficos grandes em tempo real, médias do dia e histórico de alertas. Você também acompanha o trator, com localização, combustível e motor. E a nossa equipe vai até a sua fazenda para instalar e fazer a manutenção dos equipamentos, de graça."
    }
};
