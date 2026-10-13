-- A contagem da API pode ficar abaixo do que se lê (o cadastro muda durante a
-- leitura de ~220 páginas; 1ª carga em 09/10: 4.459 lidos × 4.450 informados).
-- Só a leitura MENOR que a informada é recusada.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.carregar_estoque_imoveis(text, integer, jsonb, integer[])'::regprocedure);
  if position('jsonb_array_length(imoveis) <> quantidade_api' in def) = 0 then
    raise exception 'trecho esperado não encontrado na função';
  end if;
  def := replace(def, 'jsonb_array_length(imoveis) <> quantidade_api', 'jsonb_array_length(imoveis) < quantidade_api');
  execute def;
end $$;
