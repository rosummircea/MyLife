# Report transaction drill-down

Report total opens an inline list of all eligible expense transactions in the selected date range. Each subcategory, including Fără subcategorie or Necategorizat, independently expands/collapses its contributing transactions directly under its row. Multiple subcategories can remain open. Nested rows are indented and use smaller text, while retaining dates and access to details/editing. Clicking a subcategory also selects its trend chart without scrolling away from the inline list. The whole-category button and small donut total explicitly open the whole-category list below.

Trend bars and the active-bar amount filter the selected subcategory’s inline list or the whole-category list by the clicked month, day or Bucharest local hour. The trend total and Toată perioada reset that bucket filter. Pointer hover and focus only change the chart readout; activating a bar changes the transaction filter.

Rows show their date and open the existing transaction details/editor. Saving reloads real data and recalculates the report. Amounts reflect only the relevant allocation, with the full transaction amount separately indicated when different. Whole-report lists never duplicate transactions that have multiple allocations. Existing validation, balance flags, permissions and save/delete behavior remain unchanged. No new Supabase schema or migrations.

Validation: build, standalone TypeScript, 71 unit tests; intercepted browser flow at 1280/390/320 px covers overall/category/direct allocation selection, independent simultaneous subcategory expansion, collapse/re-expansion, no duplicate list below the chart, dates, opening details, recategorizing to RCA, refreshed report, zero graph bucket and restoring the full range. Browser tests modify only intercepted fixture data.

Files: components/ExpenseReport.tsx, components/ExpenseReport.css, components/ExpenseTrendChart.tsx, lib/expense-transactions.ts, tests/expense-transactions.test.cjs and this document.
