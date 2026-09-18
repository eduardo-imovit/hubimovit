-- select p.* numa view eh expandido na hora da CRIACAO da view -- as colunas
-- novas (proprietario_nome, proprietario_email, imovel_titulo, imovel_endereco)
-- nao apareciam na view porque ela foi criada antes delas existirem no
-- schema. CREATE OR REPLACE VIEW nao aceita mudar a posicao/quantidade de
-- colunas anteriores a uma coluna calculada existente (status_efetivo),
-- entao precisa DROP + CREATE. Mesma definicao de antes, só recriada.

drop view propostas_ativas;

create view propostas_ativas as
  select
    p.*,
    case
      when p.link_expira_em < now() and p.status not in ('sincronizada', 'rejeitada', 'expirada')
        then 'expirada'
      else p.status
    end as status_efetivo
  from propostas_locacao p
  where p.status <> 'sincronizada'
  order by p.timestamp_criacao desc;
