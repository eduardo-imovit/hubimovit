// Equipe na Apresentação Imovit (fotos do ensaio de 2026 em public/apresentacao/equipe).
// Nomes e áreas a partir de colaboradores_raw (CRM); rótulos em linguagem de cliente.
// Para incluir alguém: foto 720x900 (4:5) na pasta e uma linha aqui.

const f = (slug) => `/apresentacao/equipe/${slug}.jpg`

export const EQUIPE = [
  { grupo: 'Direção', nome: 'Daniel Aranovich', area: 'Sócio', foto: f('daniel-aranovich') },

  { grupo: 'Consultoria', nome: 'Maria Inês', area: 'Vendas', foto: f('maria-ines') },
  { grupo: 'Consultoria', nome: 'Ricardo Pinheiro', area: 'Vendas', foto: f('ricardo-pinheiro') },
  { grupo: 'Consultoria', nome: 'Rachel Bittencourt', area: 'Vendas', foto: f('rachel-bittencourt') },
  { grupo: 'Consultoria', nome: 'Patrícia Macedo', area: 'Vendas', foto: f('patricia-macedo') },
  { grupo: 'Consultoria', nome: 'Gabriel Betti', area: 'Vendas', foto: f('gabriel-betti') },
  { grupo: 'Consultoria', nome: 'Sandra Nobre', area: 'Consultoria', foto: f('sandra-nobre') },
  { grupo: 'Consultoria', nome: 'Gabriel Rosa', area: 'Gestão comercial · Locação', foto: f('gabriel-rosa') },
  { grupo: 'Consultoria', nome: 'Daniela Margadona', nomeCrm: 'Daniela Borges Margadona', area: 'Locação', foto: f('daniela-margadona') },
  { grupo: 'Consultoria', nome: 'Lucas Velloso', area: 'Locação', foto: f('lucas-velloso') },
  { grupo: 'Consultoria', nome: 'Gabriel Simon', area: 'Locação', foto: f('gabriel-simon') },

  { grupo: 'Bastidores', nome: 'Danielle Marchilli', nomeCrm: 'Danielle Cipriano Marchilli', area: 'Gestão administrativa', foto: f('danielle-marchilli') },
  { grupo: 'Bastidores', nome: 'Gabriela Jonsson', area: 'Contratos', foto: f('gabriela-jonsson') },
  { grupo: 'Bastidores', nome: 'Daniele Manteli', nomeCrm: 'Daniele Cristine Manteli', area: 'Relacionamento', foto: f('daniele-manteli') },
  { grupo: 'Bastidores', nome: 'Gabriele Alves', nomeCrm: 'Gabriele de Oliveira Alves', area: 'Administrativo', foto: f('gabriele-alves') },
  { grupo: 'Bastidores', nome: 'Roberta Barreto', area: 'Administrativo', foto: f('roberta-barreto') },
  { grupo: 'Bastidores', nome: 'Ana Celia Andrade', nomeCrm: 'Ana Celia de Sousa Andrade', area: 'Financeiro', foto: f('ana-celia') },
  { grupo: 'Bastidores', nome: 'Caroline Costa', nomeCrm: 'Caroline Camilo Costa', area: 'Conteúdo e marca', foto: f('caroline-costa') },
  { grupo: 'Bastidores', nome: 'Eduardo Jesus', area: 'Dados e marketing', foto: f('eduardo-jesus') },
]

/** Pessoa da equipe pelo nome que vem do CRM (o do link do consultor). */
export function pessoaPorNomeCrm(nome) {
  if (!nome) return null
  const n = nome.trim().toLowerCase()
  return EQUIPE.find((p) => (p.nomeCrm ?? p.nome).toLowerCase() === n)
    ?? EQUIPE.find((p) => n.startsWith(p.nome.toLowerCase()))
    ?? null
}
