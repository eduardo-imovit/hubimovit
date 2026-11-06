import { usePerfil } from '../hooks/usePerfil'

/**
 * Ajuda › Manual de uso do Hub (PRD §5.21). Todos os níveis leem, inclusive "Sem nível".
 * O texto mora aqui, no próprio Hub: para mudar o manual, edite as seções abaixo.
 * O sumário destaca a seção do nível de quem está lendo.
 */

// Nível (perfis.role) → seção por onde a pessoa deve começar
const SECAO_DO_NIVEL = {
  gestao: 'gestao',
  adm: 'adm',
  marketing: 'marketing',
  corretor: 'corretor',
  user: 'primeiro-acesso',
}

const SECOES = [
  { id: 'introducao', titulo: 'Introdução' },
  { id: 'primeiro-acesso', titulo: 'Primeiro acesso' },
  { id: 'navegacao', titulo: 'Navegação geral' },
  { id: 'corretor', titulo: 'Corretor' },
  { id: 'marketing', titulo: 'Marketing' },
  { id: 'adm', titulo: 'Admin (ADM)' },
  { id: 'gestao', titulo: 'Gestão' },
  { id: 'perguntas', titulo: 'Perguntas frequentes' },
  { id: 'suporte', titulo: 'Suporte' },
]

function Secao({ id, titulo, children }) {
  return (
    <section id={id} className="card ajuda-secao">
      <div className="card-body">
        <h2 className="ajuda-titulo">{titulo}</h2>
        {children}
      </div>
    </section>
  )
}

/** Tabela de duas colunas: linhas = [[col1, col2], ...] */
function Tabela({ cabecalho, linhas }) {
  return (
    <div className="ajuda-tabela">
      <table className="data-table">
        <thead>
          <tr>{cabecalho.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map(([a, b]) => (
            <tr key={a}><td><strong>{a}</strong></td><td>{b}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Bloco({ titulo, onde, children }) {
  return (
    <div className="ajuda-bloco">
      <h3 className="ajuda-subtitulo">
        {titulo}
        {onde && <span className="ajuda-onde"> ({onde})</span>}
      </h3>
      {children}
    </div>
  )
}

export default function Ajuda() {
  const { perfil } = usePerfil()
  const minhaSecao = SECAO_DO_NIVEL[perfil?.role]
  const tituloMinha = SECOES.find((s) => s.id === minhaSecao)?.titulo

  return (
    <div className="ajuda">
      <header className="page-header">
        <div>
          <div className="page-title">Manual de uso</div>
          <div className="page-sub">
            Como usar o Hub, por nível de acesso.
            {tituloMinha && <> Comece por <a href={`#${minhaSecao}`}><strong>{tituloMinha}</strong></a>.</>}
          </div>
        </div>
      </header>

      <nav className="ajuda-sumario" aria-label="Sumário do manual">
        {SECOES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={`ajuda-sumario-item${s.id === minhaSecao ? ' is-meu' : ''}`}>
            {s.titulo}
            {s.id === minhaSecao && <span className="badge badge-gold">seu nível</span>}
          </a>
        ))}
      </nav>

      <Secao id="introducao" titulo="Introdução">
        <p>
          O Hub Imovit é o sistema interno da Imovit: agenda, atendimentos, painéis de números, propostas de
          locação e venda e ferramentas do corretor, tudo num lugar só. Acesse em hub.imovit.com.br, pelo
          computador ou celular.
        </p>
        <p>
          Cada pessoa vê só o que o seu nível de acesso libera. Se um menu não aparece para você, não é erro:
          o seu nível não inclui aquela área.
        </p>
        <Tabela
          cabecalho={['Nível', 'O que libera']}
          linhas={[
            ['Gestão', 'Tudo, inclusive usuários, níveis de acesso e onboarding'],
            ['Admin (ADM)', 'Propostas, esteira, processos, cadastros, distratos, Adm locação e Kanban'],
            ['Marketing', 'Painéis e metas, TV Display e o conteúdo da Home (avisos, links, banners, plantão, fotógrafo, datas)'],
            ['Corretor', 'Os próprios números, atendimentos e atividades, Performance da mídia, Estoque e Ferramentas'],
            ['Sem nível', 'Só Home e Perfil, até a Gestão aprovar um nível'],
            ['Acesso TV', 'Conta usada na TV do escritório'],
          ]}
        />
      </Secao>

      <Secao id="primeiro-acesso" titulo="Primeiro acesso">
        <p>
          A conta é criada com o seu e-mail @imovit.com.br. Quem entra pela primeira vez fica "Sem nível" até
          a Gestão liberar.
        </p>
        <ol>
          <li>Abra hub.imovit.com.br e clique em <strong>Criar conta</strong>, com o e-mail @imovit.com.br que a Gestão enviou.</li>
          <li>Abra o e-mail de confirmação e clique no link. Não chegou? Na tela "Confirme seu e-mail" há o botão para reenviar.</li>
          <li>Entre no Hub. Você verá só Home e Perfil.</li>
          <li>Vá em <strong>Perfil</strong> (sua foto e nome, no canto da barra de menu) e peça o seu nível, com um motivo curto.</li>
          <li>Quando a Gestão aprovar, o menu se monta sozinho com as áreas do seu nível.</li>
        </ol>
        <p>No Perfil você também edita nome, telefone, cargo e foto.</p>
        <p><strong>Esqueci a senha:</strong> na tela de login, clique em "Esqueci a senha" e siga o link que chega no e-mail.</p>
        <p><strong>"Acesso suspenso":</strong> a Gestão suspendeu a conta. Só ela reativa.</p>
      </Secao>

      <Secao id="navegacao" titulo="Navegação geral">
        <p>
          O menu do topo é organizado por tipo de trabalho. Cada item só aparece se o seu nível tiver acesso.
          No celular, o menu abre pelo botão de três linhas.
        </p>
        <Tabela
          cabecalho={['Menu', 'O que tem dentro']}
          linhas={[
            ['Home', 'Atalhos, pendências, campanha do mês, plantão, compromissos, avisos e links'],
            ['Painéis', 'Comercial ("Meus números" para o corretor), Painel da Gestão, Painel de Performance, Estoque, Adm locação'],
            ['Atendimento', 'Kanban, Dados de atendimento, Relatório de atividades, Captações, Feedback de visita'],
            ['Locação', 'Propostas, Esteira, Processos, Cadastros, Distratos, Guia do processo'],
            ['Venda', 'Propostas e Processos'],
            ['Ferramentas', 'Materiais para clientes, Links de cadastro, TV Display'],
            ['Configurações', 'Conteúdo da Home, usuários e onboarding'],
            ['Ajuda', 'Este manual'],
          ]}
        />
        <p>
          <strong>Home:</strong> é a porta de entrada. As pendências levam direto à tela onde a ação acontece.
          A agenda completa (mês, semana e dia) fica em <strong>Agenda</strong>, com reuniões, avisos, datas
          comemorativas e os horários do fotógrafo.
        </p>
        <p>
          <strong>Filtros dos painéis:</strong> ficam no endereço da página. Copie o link e quem abrir verá os
          mesmos filtros.
        </p>
      </Secao>

      <Secao id="corretor" titulo="Corretor">
        <p>O corretor vê os próprios números e atendimentos, nunca os dos colegas.</p>
        <Bloco titulo="Acompanhar meus números">
          <ul>
            <li><strong>Painéis ▸ Meus números:</strong> seus atendimentos, atividades e negócios.</li>
            <li><strong>Painéis ▸ Painel de Performance:</strong> mídia paga e leads da imobiliária inteira.</li>
            <li><strong>Atendimento ▸ Kanban:</strong> seus atendimentos por fase, do pré-atendimento ao negócio.</li>
            <li><strong>Atendimento ▸ Relatório de atividades:</strong> suas atividades contra a meta diária.</li>
          </ul>
        </Bloco>
        <Bloco titulo="Buscar imóvel para um cliente" onde="Painéis ▸ Estoque">
          <ol>
            <li>Marque os filtros: finalidade, tipo, bairros, preço, quartos, suítes, vagas, área.</li>
            <li>Veja o resultado em dois blocos: "Atendem a tudo" e "Quase lá", com o motivo de cada um (ex.: "8% acima do teto").</li>
            <li>Clique no código para abrir o imóvel no Imoview. Selo de desatualizado = mais de 45 dias sem atualização.</li>
          </ol>
        </Bloco>
        <Bloco titulo="Captação de imóvel" onde="Atendimento ▸ Captações">
          <ol>
            <li>Copie o seu link fixo de captação e mande ao proprietário.</li>
            <li>Ele preenche pelo celular, sem login, e assina a autorização.</li>
            <li>Você recebe um e-mail, e a captação aparece na lista com o PDF da autorização.</li>
          </ol>
        </Bloco>
        <p><strong>Feedback de visita</strong> (Atendimento ▸ Feedback de visita): preencha o formulário e clique em "Gerar PDF". Fica salvo no seu histórico.</p>
        <p><strong>Cadastro de cliente</strong> (Ferramentas ▸ Links de cadastro): copie o link do tipo certo (locador, locatário ou fiador, PF ou PJ) e mande ao cliente.</p>
        <p><strong>Materiais para clientes</strong> (Ferramentas): apresentações e materiais prontos para enviar.</p>
        <p><strong>Dúvida no processo de locação:</strong> Locação ▸ Guia do processo mostra as etapas e quem faz cada uma.</p>
      </Secao>

      <Secao id="marketing" titulo="Marketing">
        <p>O Marketing cuida dos painéis de resultado e de tudo o que aparece na Home e na TV.</p>
        <Bloco titulo="Painéis">
          <ul>
            <li><strong>Painel de Performance:</strong> gasto de mídia contra orçamento, campanhas, o caminho do lead até o negócio e onde investir. Filtre por período, plataforma, etapa, finalidade e campanha.</li>
            <li><strong>Painel da Gestão</strong> e <strong>Comercial:</strong> os números do time inteiro.</li>
          </ul>
        </Bloco>
        <Bloco titulo="Atualizar a Home" onde="Configurações">
          <Tabela
            cabecalho={['Aba', 'O que você faz']}
            linhas={[
              ['Avisos & Links', 'Publica avisos e links úteis da Home'],
              ['Banners da Home', 'Sobe as imagens do carrossel'],
              ['Plantão', 'Monta a escala; "Importar escala (PDF)" mostra uma prévia antes de gravar'],
              ['Agenda do Fotógrafo', 'Cadastra o horário fixo semanal de cada corretor (ex.: toda terça, 12h–14h)'],
              ['Datas Comemorativas', 'Cadastra as datas que aparecem na Agenda'],
            ]}
          />
          <p>O que você cria aparece na Home e na TV na próxima atualização. "Remover" desativa o item, sem apagar o histórico.</p>
        </Bloco>
        <p><strong>TV Display</strong> (Ferramentas): a tela fixa do escritório, com carrossel automático. No rodapé, clique numa barrinha para ir direto a um painel.</p>
      </Secao>

      <Secao id="adm" titulo="Admin (ADM)">
        <p>O ADM conduz as propostas de locação e venda até o fim, os distratos e a carteira de contratos.</p>
        <Bloco titulo="Proposta de locação, do registro ao Imoview" onde="menu Locação">
          <ol>
            <li><strong>Propostas ▸ Nova proposta:</strong> registre locatário, imóvel e as condições negociadas (valor, garantia, posse, prazo, taxa de administração). A taxa não aparece para o locatário.</li>
            <li>O locatário recebe um e-mail e valida a proposta no portal. Se pedir correção, ela aparece no topo de Propostas e na sua Home: clique em "Corrigir e reenviar".</li>
            <li>Validada, a esteira abre: o locatário completa o cadastro e envia os documentos. Ele tem 30 dias.</li>
            <li><strong>Esteira:</strong> aprove ou reprove cada documento. Se algo foi reprovado, clique em "Solicitar ajustes": o locatário recebe um único e-mail com os motivos.</li>
            <li>Com tudo aprovado, clique em <strong>Finalizar</strong>. O Hub baixa um .zip com os documentos, limpa o armazenamento e manda ao Imoview.</li>
            <li><strong>Processos:</strong> histórico de todas as propostas, inclusive as concluídas.</li>
          </ol>
          <p className="ajuda-atencao">
            <strong>Atenção:</strong> o Finalizar apaga os documentos do Hub. Confira se o .zip foi salvo no seu
            computador antes de seguir.
          </p>
        </Bloco>
        <p><strong>Proposta de venda</strong> (menu Venda): crie a proposta, o proponente recebe o link, informa valor e condições e assina. A proposta assinada vai para Processos com o PDF. O link vale 7 dias.</p>
        <p><strong>Cadastros</strong> (Locação ▸ Cadastros): lista dos cadastros de locador, locatário e fiador recebidos, com filtro, e os links para enviar ao cliente.</p>
        <Bloco titulo="Distrato" onde="Locação ▸ Distratos">
          <ol>
            <li>"Novo distrato" ▸ busque o contrato ativo e confirme.</li>
            <li>Envie o link ao locatário: copiar, WhatsApp com mensagem pronta ou e-mail.</li>
            <li>Ele preenche o aviso pelo celular e recebe o comprovante. Você acompanha o status na lista e usa "Copiar motivo para o Imoview".</li>
          </ol>
        </Bloco>
        <p><strong>Adm locação</strong> (Painéis): administração recebida, contratos ativos, inadimplência, novos e encerrados. Os números vêm do Imoview; "Atualizar agora" força uma nova leitura.</p>
        <p><strong>Dados bancários dos colaboradores:</strong> Configurações ▸ Usuários &amp; Acessos.</p>
      </Secao>

      <Secao id="gestao" titulo="Gestão">
        <p>A Gestão vê tudo o que os outros níveis veem, mais os painéis do negócio e o controle de quem entra no Hub.</p>
        <Bloco titulo="Painéis">
          <ul>
            <li><strong>Painel da Gestão:</strong> manchete do período, ritmo, funil, custo da perda, canais, pessoas e saúde dos dados. Filtre por período, finalidade, canal e corretor.</li>
            <li><strong>Comercial, Performance, Estoque e Adm locação:</strong> como descrito nas seções de cada nível.</li>
            <li><strong>Ver o Hub como</strong> (na Home): mostra o Hub como outro nível o vê. Útil para conferir o que um corretor enxerga.</li>
          </ul>
        </Bloco>
        <Bloco titulo="Liberar o nível de alguém" onde="Configurações ▸ Usuários & Acessos">
          <ul>
            <li>Aprove ou recuse os pedidos feitos pelo Perfil.</li>
            <li>Troque o nível de quem já tem conta, ou mande o link de redefinir senha.</li>
            <li><strong>Suspender</strong> corta o acesso na hora e pode ser desfeito. <strong>Excluir</strong> não tem volta: prefira Suspender.</li>
          </ul>
        </Bloco>
        <Bloco titulo="Trazer um colaborador novo" onde="Configurações ▸ Onboarding">
          <ol>
            <li>"Novo colaborador" ▸ copie o link ou mande pelo WhatsApp.</li>
            <li>A pessoa preenche nome, WhatsApp, CPF, CRECI, equipe e endereço pelo celular.</li>
            <li>Abra a ficha: copie os dados para criar o e-mail @imovit e o usuário no Imoview.</li>
            <li><strong>Aprovar:</strong> informe o e-mail @imovit e o código do Imoview. Se já forem de outra pessoa, o Hub avisa e não aprova.</li>
            <li><strong>Enviar acesso:</strong> abre o WhatsApp com o e-mail e o link do Hub.</li>
            <li>Siga o checklist de 10 etapas. Quando o login existir, use "Definir nível". A etapa "Fila de repique" mostra o que acrescentar na automação.</li>
          </ol>
        </Bloco>
      </Secao>

      <Secao id="perguntas" titulo="Perguntas frequentes">
        <Tabela
          cabecalho={['Situação', 'O que fazer']}
          linhas={[
            ['Um menu sumiu ou não aparece', 'Seu nível não inclui aquela área. Peça outro nível pelo Perfil'],
            ['Abri um link e voltei para a Home', 'Mesma causa: a página não é do seu nível'],
            ['Não recebi o e-mail de confirmação', 'Olhe o spam e use "Reenviar" na tela "Confirme seu e-mail"'],
            ['Os números do painel parecem atrasados', 'Os dados do CRM são lidos uma vez por dia, de manhã. O painel mostra a data da última leitura'],
            ['Um item que eu criei sumiu', 'Alguém pode ter clicado em "Remover", que desativa o item. Fale com quem cuida da Home'],
            ['O cliente diz que o link expirou', 'Links de proposta, distrato e onboarding vencem. Gere um novo pela tela correspondente'],
            ['A TV parou de atualizar', 'Recarregue a página da TV (F5). Ela mantém o último valor se perder a conexão'],
          ]}
        />
      </Secao>

      <Secao id="suporte" titulo="Suporte">
        <p>Dúvidas de acesso e nível: fale com a Gestão. Para reportar um problema, mande ao Eduardo:</p>
        <ol>
          <li>O que você tentou fazer.</li>
          <li>O que apareceu (um print ajuda muito).</li>
          <li>O endereço da página, copiado do navegador.</li>
          <li>O horário aproximado.</li>
        </ol>
      </Secao>
    </div>
  )
}
