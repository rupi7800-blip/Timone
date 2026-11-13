-- =====================================================================
-- Timone · configurazione del database (PostgreSQL / Supabase)
-- Vale sia per Supabase in cloud sia per Supabase installato sul server
-- dell'azienda: lo schema è identico, cambia solo l'indirizzo.
-- Incolla tutto nel SQL Editor e premi "Run". Si può rieseguire senza danni.
--
-- Isolamento: ogni azienda è visibile solo ai suoi membri (Row Level Security).
-- Ruoli per azienda:
--   titolare        tutto, compresi utenti ed eliminazione dell'azienda
--   amministrazione inserisce e modifica i dati
--   consulente      inserisce e modifica i dati (consulente esterno)
--   sola_lettura    consulta soltanto
-- Ogni valore conserva origine, fonte, data e stato di verifica; ogni modifica
-- finisce nello storico con autore e data.
-- =====================================================================

create table if not exists public.aziende (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (char_length(nome) between 1 and 120),
  profilo   jsonb not null default '{}'::jsonb,   -- settore, forma, ATECO, classificazione costi, budget, scenari
  creato_da uuid references auth.users(id) on delete set null,
  creato    timestamptz not null default now()
);

create table if not exists public.membri (
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ruolo      text not null default 'sola_lettura' check (ruolo in ('titolare','amministrazione','consulente','sola_lettura')),
  creato     timestamptz not null default now(),
  primary key (azienda_id, user_id)
);
create index if not exists membri_user_idx on public.membri (user_id);

create table if not exists public.valori (
  azienda_id     uuid not null references public.aziende(id) on delete cascade,
  anno           int  not null check (anno between 1990 and 2100),
  voce           text not null check (char_length(voce) between 1 and 60),
  valore         numeric(18,2) not null,
  origine        text not null default 'manuale' check (origine in ('manuale','importato','misurato','stimato','previsto','simulato')),
  fonte          text check (fonte is null or char_length(fonte) <= 300),
  stato_verifica text not null default 'da verificare' check (stato_verifica in ('da verificare','verificato','simulato')),
  acquisito_il   timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  aggiornato_da  uuid default auth.uid(),
  primary key (azienda_id, anno, voce)
);

create table if not exists public.storico_valori (
  id           bigint generated always as identity primary key,
  azienda_id   uuid not null references public.aziende(id) on delete cascade,
  anno         int not null,
  voce         text not null,
  valore_prima numeric(18,2),
  valore_dopo  numeric(18,2),
  origine      text,
  fonte        text,
  autore       uuid,
  quando       timestamptz not null default now()
);
create index if not exists storico_azienda_idx on public.storico_valori (azienda_id, quando desc);

-- funzioni di appartenenza (security definer: evitano ricorsione nelle policy)
create or replace function public.mio_ruolo(p_azienda uuid) returns text
language sql stable security definer set search_path = public as $$
  select ruolo from membri where azienda_id = p_azienda and user_id = auth.uid();
$$;
create or replace function public.posso_scrivere(p_azienda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mio_ruolo(p_azienda) in ('titolare','amministrazione','consulente'), false);
$$;

-- storico automatico delle modifiche
create or replace function public.registra_storico() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- se si sta eliminando l'intera azienda non c'è più nulla da registrare
    if exists (select 1 from aziende where id = old.azienda_id) then
      insert into storico_valori (azienda_id, anno, voce, valore_prima, valore_dopo, origine, fonte, autore)
      values (old.azienda_id, old.anno, old.voce, old.valore, null, old.origine, old.fonte, auth.uid());
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.valore is distinct from old.valore or new.stato_verifica is distinct from old.stato_verifica then
      new.aggiornato_il := now(); new.aggiornato_da := auth.uid();
      insert into storico_valori (azienda_id, anno, voce, valore_prima, valore_dopo, origine, fonte, autore)
      values (new.azienda_id, new.anno, new.voce, old.valore, new.valore, new.origine, new.fonte, auth.uid());
    end if;
    return new;
  end if;
  insert into storico_valori (azienda_id, anno, voce, valore_prima, valore_dopo, origine, fonte, autore)
  values (new.azienda_id, new.anno, new.voce, null, new.valore, new.origine, new.fonte, auth.uid());
  return new;
end $$;
drop trigger if exists timone_storico_iu on public.valori;
drop trigger if exists timone_storico_d on public.valori;
drop trigger if exists timone_storico_u on public.valori;
drop trigger if exists timone_storico_id on public.valori;
create trigger timone_storico_u before update on public.valori
  for each row execute function public.registra_storico();
-- "after insert": non scatta quando un upsert diventa un aggiornamento
create trigger timone_storico_id after insert or delete on public.valori
  for each row execute function public.registra_storico();

-- creazione di un'azienda: chi la crea ne diventa titolare
create or replace function public.crea_azienda(p_nome text, p_profilo jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare nuovo uuid;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  insert into aziende (nome, profilo, creato_da) values (p_nome, coalesce(p_profilo, '{}'::jsonb), auth.uid()) returning id into nuovo;
  insert into membri (azienda_id, user_id, ruolo) values (nuovo, auth.uid(), 'titolare');
  return nuovo;
end $$;

-- il titolare aggiunge un utente già registrato (per email) con un ruolo
create or replace function public.aggiungi_membro(p_azienda uuid, p_email text, p_ruolo text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if coalesce(mio_ruolo(p_azienda), '') <> 'titolare' then raise exception 'Solo il titolare può gestire gli utenti'; end if;
  if p_ruolo not in ('titolare','amministrazione','consulente','sola_lettura') then raise exception 'Ruolo non valido'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'Nessun utente registrato con questa email: deve prima creare il proprio account'; end if;
  insert into membri (azienda_id, user_id, ruolo) values (p_azienda, u, p_ruolo)
  on conflict (azienda_id, user_id) do update set ruolo = excluded.ruolo;
end $$;

create or replace function public.elenco_membri(p_azienda uuid)
returns table (email text, ruolo text)
language sql stable security definer set search_path = public as $$
  select u.email::text, m.ruolo from membri m join auth.users u on u.id = m.user_id
  where m.azienda_id = p_azienda and mio_ruolo(p_azienda) = 'titolare'
  order by m.creato;
$$;

-- Row Level Security
alter table public.aziende enable row level security;
alter table public.membri enable row level security;
alter table public.valori enable row level security;
alter table public.storico_valori enable row level security;

drop policy if exists "az leggi" on public.aziende;
drop policy if exists "az modifica" on public.aziende;
drop policy if exists "az elimina" on public.aziende;
create policy "az leggi" on public.aziende for select to authenticated using (mio_ruolo(id) is not null);
create policy "az modifica" on public.aziende for update to authenticated using (posso_scrivere(id)) with check (posso_scrivere(id));
create policy "az elimina" on public.aziende for delete to authenticated using (mio_ruolo(id) = 'titolare');

drop policy if exists "mem leggi" on public.membri;
create policy "mem leggi" on public.membri for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "val leggi" on public.valori;
drop policy if exists "val crea" on public.valori;
drop policy if exists "val modifica" on public.valori;
drop policy if exists "val elimina" on public.valori;
create policy "val leggi" on public.valori for select to authenticated using (mio_ruolo(azienda_id) is not null);
create policy "val crea" on public.valori for insert to authenticated with check (posso_scrivere(azienda_id));
create policy "val modifica" on public.valori for update to authenticated using (posso_scrivere(azienda_id)) with check (posso_scrivere(azienda_id));
create policy "val elimina" on public.valori for delete to authenticated using (posso_scrivere(azienda_id));

drop policy if exists "sto leggi" on public.storico_valori;
create policy "sto leggi" on public.storico_valori for select to authenticated using (mio_ruolo(azienda_id) is not null);

-- permessi
grant usage on schema public to authenticated;
grant select, update, delete on public.aziende to authenticated;
grant select on public.membri, public.storico_valori to authenticated;
grant select, insert, update, delete on public.valori to authenticated;
revoke execute on function public.mio_ruolo(uuid), public.posso_scrivere(uuid), public.crea_azienda(text, jsonb),
  public.aggiungi_membro(uuid, text, text), public.elenco_membri(uuid), public.registra_storico() from public, anon;
grant execute on function public.mio_ruolo(uuid), public.posso_scrivere(uuid), public.crea_azienda(text, jsonb),
  public.aggiungi_membro(uuid, text, text), public.elenco_membri(uuid) to authenticated;
revoke execute on function public.registra_storico() from authenticated;
