# Date reale în MyLife — 17 septembrie 2026

Preview-ul local afișează un instantaneu real din Supabase, capturat la 07:38:57
(Europe/Bucharest). Exportul este în `/private/tmp`, în afara repository-ului,
și este citit doar pe localhost cu accesul temporar activ. Nu se actualizează
automat și nu este inclus în Git. Dacă fișierul temporar dispare, conectarea
Supabase rămâne disponibilă prin `Conectează live`.

Citirea live este implementată prin sesiunea utilizatorului și politicile RLS;
nu folosim chei service-role. Este necesară prima autentificare pentru a verifica
fluxul live în browser. După aceea, sesiunea este păstrată/restaurată de clientul
Supabase și `Actualizează` recitește datele.

## Disponibil acum

- 8 conturi active, cu soldurile inițiale existente.
- 483 de tranzacții confirmate: 469 cheltuieli și 14 venituri.
- 70 de categorii și 469 de alocări de cheltuieli.
- 1 document: metadatele generale, fără decriptarea conținutului.
- Raport RON cu filtre pe zi, săptămână, lună, an și interval ales.
- Categorii extensibile inline; toate subcategoriile directe, inclusiv cele cu
  sumă zero, și agregarea nivelurilor mai adânci în ramura corespunzătoare.

Totaluri verificate cu SQL Supabase:

| Perioada | Cheltuieli RON | Tranzacții |
| --- | ---: | ---: |
| Aprilie 2026 | 10.102,61 | 71 |
| Mai 2026 | 32.457,15 | 184 |
| Iunie 2026 | 23.708,24 | 163 |
| Iulie 2026 | 4.899,35 | 49 |
| August 2026 | 260,55 | 1 |
| Septembrie 2026 | 146,71 | 1 |
| Total 2026 | 71.574,61 | 469 |

## De completat

1. **Detalierea categoriilor.** 391 cheltuieli (63.514,68 RON) sunt încadrate
   direct în categoria principală; 78 (8.059,93 RON) au subcategorie.
   Sumele directe apar la `Fără subcategorie`; nu inventăm o distribuție.
2. **Istoric lunar importat separat.** Cele 31 de agregate istorice nu sunt
   adăugate raportului până stabilim suprapunerile cu tranzacțiile. Un agregat
   pentru august reprezintă un venit estimat, nu o cheltuială confirmată.
3. **Solduri curente.** Conturile afișează `opening_balance`, marcat ca sold
   inițial. Soldurile curente necesită o regulă de reconciliere cu tranzacțiile
   importate și/sau snapshot-urile de sold.
4. **Alte monede.** Raportul filtrează RON; conversia necesită reguli și cursuri.
5. **Documente.** Lista este reală, dar deschiderea fișierelor și metadatele
   decriptate nu sunt implementate în această etapă.

## Corecție Supabase și verificări

Politica `people_select_self_or_household` cauza recursie infinită. Corecția
aplicată este în `sql/fix-people-select-policy.sql`. Păstrează accesul la propriul
profil și la membrii activi ai familiei, folosind helper-ul existent.
Verificările sub rolul `authenticated` au confirmat accesul lui Mircea la date
și lipsa accesului unui utilizator fără legătură cu familia.

Build și typecheck au trecut. Cele 11 teste verifică agregarea, banii, rotunjirea,
fusul orar, perioadele, paginarea peste 1.000 de rânduri și propagarea erorilor.
Browserul a fost verificat la 1280, 390 și 320 px; exportul este exclus pentru
un Host public. Login-ul real în browser rămâne de verificat cu sesiunea lui Mircea.

Advisor-ul Supabase mai raportează avertismente existente, fără modificări în
această etapă: [pg_net în public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[funcții documente SECURITY DEFINER accesibile utilizatorilor autentificați](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
și [protecția parolelor compromise dezactivată](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Tabelele auxiliare de upload au RLS activ fără politici, deci sunt blocate pentru
clientul obișnuit: [explicație](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
