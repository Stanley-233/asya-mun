alter table public.users
    add column auth_version integer not null default 0;
