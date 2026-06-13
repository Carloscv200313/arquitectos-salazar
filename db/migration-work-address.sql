-- Agrega el domicilio / dirección de la obra a las obras (works).

alter table works
  add column if not exists address text
  check (address is null or char_length(trim(address)) between 2 and 200);
