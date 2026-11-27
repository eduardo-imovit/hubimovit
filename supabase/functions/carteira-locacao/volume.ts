// Trava de volume da carteira (27/11). Roda ANTES da RPC carregar_carteira_locacao, que
// apaga e regrava as cobranças em aberto e grava a foto do dia: uma leitura vazia ou pela
// metade (chave sem assunto, API devolvendo lista curta) viraria inadimplência falsa no Saúde.
//
// Pisos fixos iguais aos da carteira v2 do n8n (doc imoview-auth-arquitetura §7.2), tirados
// do banco em 26/11: contratos 822, ativos 154–158 (fotos 15–24/11), cobranças vencidas 80–82.
// Pagas: o piso vem do próprio banco (SELECT dos recebimentos já gravados na mesma janela de
// vencimento). Como a tabela só recebe upsert, a releitura deve trazer pelo menos isso.

export const PISOS = { contratos: 780, ativos: 140, cobrancas: 30 }
export const FRACAO_PAGAS = 0.8 // tolera estornos/baixas desfeitas; abaixo disso, algo está errado
export const PISO_PAGAS_SEM_HISTORICO = 100

export type Volume = { contratos: number; ativos: number; cobrancas: number; pagas: number; pagasNoBanco: number }

/** Devolve a lista de problemas. Vazia = pode gravar. */
export function conferirVolume(v: Volume): string[] {
  const problemas: string[] = []
  if (v.contratos < PISOS.contratos) problemas.push(`contratos ${v.contratos} < ${PISOS.contratos}`)
  if (v.ativos < PISOS.ativos) problemas.push(`ativos ${v.ativos} < ${PISOS.ativos}`)
  if (v.cobrancas < PISOS.cobrancas) problemas.push(`cobranças vencidas de locação ${v.cobrancas} < ${PISOS.cobrancas}`)
  const pisoPagas = v.pagasNoBanco > 0 ? Math.floor(v.pagasNoBanco * FRACAO_PAGAS) : PISO_PAGAS_SEM_HISTORICO
  if (v.pagas === 0 || v.pagas < pisoPagas) {
    problemas.push(`pagas ${v.pagas} < ${pisoPagas} (${v.pagasNoBanco} já no banco na mesma janela)`)
  }
  return problemas
}
