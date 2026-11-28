/* =============================================================
   EXPORTAR.JS — Relatórios em PDF e Excel com um clique
   MR.exportar(tipo, filtros, formato)  formato: "pdf" | "xlsx"
   Busca os dados prontos em backend/relatorios/gerar.php e monta o
   arquivo no navegador (jsPDF + AutoTable / SheetJS, via CDN).
   Requer modulos.js.
   ============================================================= */

(() => {
  const LIBS = {
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  };

  function formatar(valor, tipo) {
    if (valor === null || valor === undefined || valor === "") return "";
    switch (tipo) {
      case "moeda": return MR.moeda(valor);
      case "numero": return MR.num(valor);
      case "percentual": return MR.num(valor, 2) + "%";
      case "data": return MR.data(valor);
      default: return String(valor);
    }
  }

  function nomeArquivo(rel, ext) {
    const base = (rel.titulo || "relatorio").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    return `${base}-${MR.hoje()}.${ext}`;
  }

  async function gerarPdf(rel) {
    await MR.carregarScript(LIBS.jspdf);
    await MR.carregarScript(LIBS.autotable);
    const { jsPDF } = window.jspdf;
    const paisagem = rel.colunas.length > 6;
    const doc = new jsPDF({ orientation: paisagem ? "landscape" : "portrait", unit: "pt", format: "a4" });
    const largura = doc.internal.pageSize.getWidth();

    doc.setFillColor(31, 58, 29);
    doc.rect(0, 0, largura, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(rel.titulo, 36, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`MarketPlace Rural — ${rel.subtitulo || ""}`, 36, 48);
    doc.text(`Gerado em ${rel.gerado_em}`, largura - 36, 48, { align: "right" });

    let y = 84;
    if (rel.resumo && rel.resumo.length) {
      doc.autoTable({
        startY: y,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 4, textColor: [29, 38, 28] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 180 } },
        body: rel.resumo.map((r) => [r.rotulo, formatar(r.valor, r.tipo) || "—"]),
        margin: { left: 36, right: 36 },
      });
      y = doc.lastAutoTable.finalY + 14;
    }

    doc.autoTable({
      startY: y,
      head: [rel.colunas.map((c) => c.rotulo)],
      body: rel.linhas.length
        ? rel.linhas.map((l) => rel.colunas.map((c) => formatar(l[c.chave], c.tipo)))
        : [[{ content: "Nenhum registro no período.", colSpan: rel.colunas.length, styles: { halign: "center" } }]],
      styles: { fontSize: paisagem ? 8 : 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [79, 119, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 240, 230] },
      columnStyles: Object.fromEntries(rel.colunas.map((c, i) => [i, { halign: ["moeda", "numero", "percentual"].includes(c.tipo) ? "right" : "left" }])),
      margin: { left: 36, right: 36 },
      didDrawPage: () => {
        const altura = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, largura - 36, altura - 18, { align: "right" });
      },
    });

    doc.save(nomeArquivo(rel, "pdf"));
  }

  async function gerarXlsx(rel) {
    await MR.carregarScript(LIBS.xlsx);
    const XLSX = window.XLSX;
    const linhas = [
      [rel.titulo],
      [rel.subtitulo || ""],
      ["Gerado em " + rel.gerado_em],
      [],
      rel.colunas.map((c) => c.rotulo),
      ...rel.linhas.map((l) => rel.colunas.map((c) => {
        const v = l[c.chave];
        if (v === null || v === undefined) return "";
        if (["moeda", "numero", "percentual"].includes(c.tipo) && !isNaN(v)) return Number(v);
        if (c.tipo === "data") return MR.data(v);
        return v;
      })),
    ];
    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    planilha["!cols"] = rel.colunas.map((c) => ({ wch: Math.max(12, c.rotulo.length + 2, c.tipo === "texto" ? 22 : 12) }));
    // Formato numérico das colunas de valores.
    rel.colunas.forEach((c, i) => {
      const fmt = c.tipo === "moeda" ? '"R$" #,##0.00' : c.tipo === "percentual" ? '0.00"%"' : c.tipo === "numero" ? "#,##0.00" : null;
      if (!fmt) return;
      for (let r = 5; r < 5 + rel.linhas.length; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: i });
        if (planilha[ref] && typeof planilha[ref].v === "number") planilha[ref].z = fmt;
      }
    });

    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Dados");
    if (rel.resumo && rel.resumo.length) {
      const resumo = XLSX.utils.aoa_to_sheet([["Indicador", "Valor"], ...rel.resumo.map((r) => [r.rotulo, r.valor ?? ""])]);
      resumo["!cols"] = [{ wch: 30 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(livro, resumo, "Resumo");
    }
    XLSX.writeFile(livro, nomeArquivo(rel, "xlsx"));
  }

  async function exportar(tipo, filtros = {}, formato = "pdf") {
    const params = new URLSearchParams({ tipo });
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const rel = await MR.api("relatorios/gerar.php?" + params);
      if (formato === "xlsx") await gerarXlsx(rel);
      else await gerarPdf(rel);
      MR.toast(`${rel.titulo} exportado (${formato === "xlsx" ? "Excel" : "PDF"}).`);
    } catch (erro) {
      MR.toast(erro.message, "erro");
    }
  }

  window.MR = Object.assign(window.MR || {}, { exportar });
})();
