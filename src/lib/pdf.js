/**
 * Gera e baixa um PDF A4 a partir de um elemento já renderizado (documentos no
 * padrão Imovit: captação, feedback de visita). Imagens dentro do elemento
 * precisam ser do mesmo domínio ou data URL, senão o html2canvas contamina o canvas.
 */
export async function baixarPdfDoElemento(elemento, nomeArquivo) {
  if (!elemento) throw new Error('Documento não renderizado')
  const { default: html2pdf } = await import('html2pdf.js')
  await html2pdf()
    .set({
      margin: 10,
      filename: nomeArquivo,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.doc-bloco'] },
    })
    .from(elemento)
    .save()
}
