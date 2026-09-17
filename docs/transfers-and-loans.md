# Transferuri și împrumuturi

Transferurile sunt înregistrări existente `finance_transactions.transaction_type = transfer`, cu `account_id` sursă și `transfer_account_id` destinație. Lista dedicată, lista zilnică și detaliile folosesc aceeași înregistrare. Nu se creează copii și nu se includ în raportul de cheltuieli. Dacă un cont nu poate fi citit, numele este marcat indisponibil, fără presupuneri.

În schema inspectată nu există tabel pentru împrumuturi. Migrarea propusă este `sql/create-finance-loans.sql`; nu trebuie aplicată fără aprobarea utilizatorului. UI-ul refuză salvarea până când are o sesiune live și citirea tabelului reușește. Nu folosește mock-uri sau localStorage pentru împrumuturile personale.

Împrumuturile sunt împărțite în date (`given`) și primite (`received`), cu persoană, dată, sumă, monedă, motiv și notițe. Totalurile reprezintă principalul minus suma rambursată, separat pe monedă. Sumele sunt calculate în cenți și înregistrările rambursate integral rămân vizibile. Rambursarea actualizează cumulul prin compare-and-set, evitând suprascrierea unei modificări concurente. În această primă versiune nu există jurnal cu datele fiecărei rambursări, dobândă, conversie valutară sau ștergere/editare a termenilor.

Împrumuturile nu creează automat tranzacții și nu modifică soldurile. Salvarea se face cu client public, sesiune și RLS pentru membrii activi ai familiei. Permisiunea UPDATE este limitată la `repaid_amount`. Crearea cere `created_by_user_id = auth.uid()`; citirea/rambursarea cere apartenența activă la familie.
