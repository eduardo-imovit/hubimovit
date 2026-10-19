import ModalPortal from '../esteira/ModalPortal'
import { TIPOS_CADASTRO } from '../../lib/cadastros'

const ROTULOS = {
  nome: 'Nome', razao_social: 'Razão social', cpf: 'CPF', cnpj: 'CNPJ',
  rg: 'RG', nascimento: 'Nascimento', estado_civil: 'Estado civil',
  nacionalidade: 'Nacionalidade', profissao: 'Profissão', celular: 'Celular',
  telefone: 'Telefone', endereco: 'Endereço', complemento: 'Complemento',
  bairro: 'Bairro', cidade: 'Cidade', estado: 'Estado', cep: 'CEP',
  inscricao_municipal: 'Inscrição municipal', inscricao_estadual: 'Inscrição estadual',
  favorecido: 'Favorecido', banco: 'Banco', agencia: 'Agência',
  tipo_conta: 'Tipo de conta', numero_conta: 'Número da conta',
  administradora: 'Administradora', telefone_administradora: 'Tel. administradora',
  iptu: 'IPTU', cpfl: 'CPFL', sanasa: 'Sanasa', gas: 'Gás', email: 'E-mail',
}
const rotulo = (k) => ROTULOS[k] ?? k.replace(/_/g, ' ').replace(/^extra_/, '')

function Secao({ titulo, obj }) {
  const entradas = Object.entries(obj ?? {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  if (entradas.length === 0) return null
  return (
    <div>
      <div className="page-eyebrow">{titulo}</div>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {entradas.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <dt style={{ minWidth: 140, color: 'var(--grafite-fade)' }}>{rotulo(k)}</dt>
            <dd style={{ margin: 0 }}>{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Detalhe de um cadastro (RF30.4, PRD §5.17): a resposta completa, como
 * chegou — mesmos campos do formulário, sem edição.
 */
export default function CadastroDetalheModal({ cadastro, onClose }) {
  if (!cadastro) return null
  const cfg = TIPOS_CADASTRO[cadastro.tipo]
  const ehPJ = cadastro.tipo?.endsWith('-pj')
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{cfg?.titulo ?? cadastro.tipo} — {cadastro.pessoa?.nome ?? cadastro.pessoa?.razao_social ?? cadastro.email}</div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Secao titulo="Quem preencheu" obj={{ email: cadastro.email }} />
            <Secao titulo={ehPJ ? 'Empresa' : 'Pessoa'} obj={cadastro.pessoa} />
            <Secao titulo={ehPJ ? 'Sócio / representante' : 'Cônjuge'} obj={cadastro.acompanhante} />
            <Secao titulo="Dados financeiros" obj={cadastro.financeiro} />
            <Secao titulo="Imóvel" obj={cadastro.imovel} />
            <div className="avisos-item-sub">
              Recebido em {new Date(cadastro.created_at).toLocaleString('pt-BR')} · origem {cadastro.origem === 'planilha' ? 'Planilha' : 'Hub'} · e-mail {cadastro.email_ok ? 'enviado' : '—'}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
