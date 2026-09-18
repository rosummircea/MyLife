# Report transaction drill-down

Report total opens an inline list of all eligible expense transactions in the selected date range. Expanding a category shows its contributing transactions immediately. Selecting a subcategory, including the synthetic Fără subcategorie or Necategorizat rows, narrows the list to that allocation. The whole-category button and the total in the small donut reset the filter.

Trend bars and the active-bar amount filter the current category/subcategory list by the clicked month, day or Bucharest local hour. The trend total and Toată perioada reset that bucket filter. Pointer hover and focus only change the chart readout; activating a bar changes the transaction filter.

Rows show their date and open the existing transaction details/editor. Saving reloads real data and recalculates the report. Amounts reflect only the relevant allocation, with the full transaction amount separately indicated when different. Whole-report lists never duplicate transactions that have multiple allocations. Existing validation, balance flags, permissions and save/delete behavior remain unchanged. No new Supabase schema or migrations.

Validation: build, standalone TypeScript, 71 unit tests; intercepted browser flow at 1280/390/320 px covers overall/category/direct allocation selection, dates, opening details, recategorizing to RCA, refreshed report, zero graph bucket and restoring the full range. Browser tests modify only intercepted fixture data.

Files: components/ExpenseReport.tsx, components/ExpenseReport.css, components/ExpenseTrendChart.tsx, lib/expense-transactions.ts, tests/expense-transactions.test.cjs and this document.
