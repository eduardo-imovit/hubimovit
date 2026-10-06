-- Troca de foto do perfil falhava para todos com "new row violates row-level
-- security policy" (06/10; 0 fotos desde 23/09). O upload do Storage grava e
-- devolve o objeto (INSERT ... RETURNING / upsert), o que exige uma policy de
-- SELECT; o bucket avatares só tinha INSERT, UPDATE e DELETE. A exibição não
-- depende disto (bucket público). Cada um lê só a própria pasta.
create policy avatares_select_proprio on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and split_part(name, '/', 1) = auth.uid()::text);
