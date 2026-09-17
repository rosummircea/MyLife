# Modulul Auto — date existente și integrare

Auto citește `vehicles` și `vehicle_records` cu clientul public Supabase, sesiunea utilizatorului, filtrul `user_id` și RLS. Paginarea aduce toate înregistrările. Nu creează vehicule, documente sau tabele și nu modifică solduri ori tranzacții.

Schema inspectată: `vehicles` conține marcă, model, an, număr de înmatriculare, VIN, note și `extra`. `vehicle_records.vehicle_id` referă deja vehiculul; înregistrările au tip, emitere/expirare, furnizor, referință poliță, note și `extra`. Pentru Mircea ambele tabele erau goale la verificare. Demo-ul este opțional, etichetat și nu persistă date.

## Convenții opționale în metadata existentă

Nu au fost adăugate în DB. Data layer-ul poate citi:

- `vehicles.extra.vehicle_type`: `car` sau `motorcycle`.
- Date tehnice în `extra`: `mileage_km`, `fuel`, `power_kw`, `transmission`, `color`, `purchase_date` (YYYY-MM-DD).
- `vehicles.extra.photos`: array de `{bucket, path, caption?, primary?}`. Se folosesc numai referințe Storage, nu URL-uri publice. Preview-urile cer sesiune și signed URL de 5 minute, reînnoit înainte de expirare; politicile bucket-ului trebuie să permită accesul utilizatorului. Upload-ul fotografiilor nu este implementat.
- `vehicle_records.extra`: `date` (dacă lipsește `issued_at`), `mileage_km`, `cost`, `currency` (cod ISO, de exemplu RON). Costurile sunt totalizate separat pe monedă; nu se presupune o monedă și nu există conversie valutară. Tipurile de mentenanță sunt service, maintenance, oil_change, filters, brakes, tires, repair, inspection, itp; alte intervenții pot declara `extra.category = maintenance`.
- `documents.extra.vehicle_id`: identificator explicit al vehiculului. Modulul reutilizează lista reală de documente și viewer-ul existent. Nu deduce asocieri după numele fișierului sau numărul de înmatriculare. `storage_path` indică o referință, nu certifică existența fișierului; viewer-ul verifică accesul efectiv.

## Recomandări pentru schema viitoare (neimplementate)

1. Relație explicită document–vehicul: `documents.vehicle_id` cu FK către `vehicles.id` pentru un singur vehicul/document; alternativ tabel asociativ dacă documentele pot avea mai multe vehicule. RLS trebuie să verifice proprietarul ambelor înregistrări. Convenția `extra.vehicle_id` nu are integritatea unui FK.
2. `vehicle_photos` cu `vehicle_id`, `user_id`, `storage_bucket`, `storage_path`, caption, ordine și fotografie principală. Bucket privat și politici pentru proprietar.
3. Câmpuri validate pentru tipul vehiculului și specificațiile tehnice; câmpuri dedicate pentru data intervenției, kilometraj, cost și monedă dacă se dorește filtrare/raportare robustă.
4. O relație vehicul–tranzacție cu RLS verificabilă înaintea integrării Finanțelor. Nu există o astfel de legătură în implementarea actuală.

Până există vehicule, referințe foto accesibile și asocieri explicite, galeria și documentele aferente nu pot fi demonstrate cu date personale reale. Nu a fost schimbată schema Supabase.
