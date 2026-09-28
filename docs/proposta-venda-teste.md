# Teste — Proposta de venda (compra)

Roteiro de verificação etapa por etapa. Rode os blocos no SQL Editor
(projeto `Imovit Database`) e confira o "Esperado". Pré-requisitos:
migration `20260925130000_propostas_venda.sql` aplicada,
`supabase functions deploy proposta-venda`, push do frontend no ar.

> Os RPCs de estado só aceitam a `service_role` (Edge Function); pela API,
> `authenticated` só lê. Os SELECTs abaixo só leem tabelas/view (leitura
> como `postgres` no SQL Editor funciona).

## 0. Pré-requisitos

```sql
-- Migration aplicada?
select count(*) as tabelas_prontas
from information_schema.tables
where table_name in ('propostas_venda', 'propostas_venda_historico');
-- Esperado: 2

select proname from pg_proc where proname like '%proposta_venda%';
-- Esperado: criar_proposta_venda, confirmar_proposta_venda, descartar_proposta_venda,
-- registrar_documento_venda

select id, name, public from storage.buckets where id = 'propostas-venda';
-- Esperado: 1 linha, public = false
```

## 1. Corretor cria em /admin/vendas

Ação: logado como corretor, criar proposta (nome/e-mail do proponente,
código, valor de referência). Monitorar:

```sql
select id, nome_cliente, email, codigo_imovel, valor_referencia,
       status, link_expira_em, criado_por
from propostas_venda
order by timestamp_criacao desc limit 1;
-- Esperado: status = aguardando_cliente, criado_por preenchido,
-- link_expira_em ≈ agora + 7 dias

select status_anterior, status_novo, ator, timestamp_registro
from propostas_venda_historico
where proposta_id = '<ID_DA_ETAPA_1>'
order by timestamp_registro;
-- Esperado: 1 linha (null → aguardando_cliente, ator = e-mail do corretor)
```

E-mail: caixa do proponente recebe **"Sua proposta de compra foi criada"**
(corpo "Uma proposta de compra foi criada em seu nome", assinatura
"Equipe Relacionamento | Imovit", botão → `/venda/entrar`).
Se não chegar: ver logs da function `proposta-venda` (esperado: sem erro;
falha de Brevo só loga, não derruba a criação).

## 2. Proponente entra em /venda/entrar

Ação: mesmo e-mail, login por magic link → cai em `/venda`.
Conferir em tela: título "Proposta de compra", "Cliente/proponente" (nada de
"locatário"/"locação"), referência com valor. Monitorar:

```sql
select id, status,
  case when link_expira_em < now() then 'expirada' else status end as status_efetivo
from propostas_venda where id = '<ID>';
-- Esperado: aguardando_cliente (se der expirada, o link de 7 dias venceu —
-- crie outra proposta para o teste)
```

## 3. Proponente preenche e assina

Ação: telefone + valor da proposta + descrição + assinatura → "Assinar proposta".
Monitorar (aguardar o "✓ Proposta assinada"):

```sql
select status, telefone, valor_proposta,
       left(descricao_proposta, 60) as descricao,
       assinatura_path, documento_path
from propostas_venda where id = '<ID>';
-- Esperado: status = confirmada, telefone/valor/descricao preenchidos,
-- assinatura_path = '<ID>/assinatura.png',
-- documento_path = '<ID>/documento.pdf' (pode ficar nulo se a geração do
-- PDF falhou no navegador — a assinatura continua válida)

select status_anterior, status_novo, ator
from propostas_venda_historico where proposta_id = '<ID>'
order by timestamp_registro;
-- Esperado: +1 linha (aguardando_cliente → confirmada, ator = e-mail do proponente)

select name from storage.objects
where bucket_id = 'propostas-venda' and name like '<ID>/%';
-- Esperado: assinatura.png (+ documento.pdf)
```

E-mail interno: daniel@/gabriela@ recebem **"Nova proposta de compra assinada"**
com resumo (valor, descrição, endereço) e botão → `/admin/vendas`.

## 4. Equipe confere em /admin/vendas

Ação: Gestão/Admin abre a proposta → "Abrir documento assinado" baixa o PDF.
Monitorar: o PDF abre com dados + assinatura do proponente.
Falha comum: link assinado expira em 5 min — reabrir o detalhe gera outro.

## 5. Inteligência (dados no banco)

```sql
select codigo_imovel, imovel_titulo, imovel_endereco,
       valor_referencia, valor_proposta,
       valor_proposta - valor_referencia as delta_oferta,
       descricao_proposta, timestamp_criacao
from propostas_venda
where status = 'confirmada'
order by timestamp_criacao desc;
-- Esperado: 1 linha por venda assinada, com endereço/condições para análise
```

## Diagnóstico rápido

| Sintoma | Causa provável | Checagem |
|---|---|---|
| 403 "Só Gestão, Admin e Corretor" ao criar | usuário sem `role` em `perfis` | `select role from perfis where email = '<EMAIL>';` |
| "Você não tem acesso" no portal | e-mail do login ≠ e-mail da proposta (case conta, mas espaço não) | comparar `email` da linha com o login |
| "Link expirado" | `link_expira_em` passado | etapa 2; criar nova proposta |
| "Proposta já foi confirmada" em reenvio duplo | duplo clique | histórico mostra 1 confirmação; ignorar |
| Sem e-mail, mas proposta criada | `BREVO_API_KEY`/`APP_URL` na function | logs `proposta-venda` no Dashboard |
| "Assinatura não encontrada" ao assinar | upload do `assinatura.png` falhou ou link venceu no meio | `select name from storage.objects where bucket_id='propostas-venda' and name like '<ID>/%';` |
| `documento_path` nulo com proposta confirmada | geração do PDF falhou no navegador (a assinatura vale) | console do navegador; `[venda] falha ao gerar PDF` |
