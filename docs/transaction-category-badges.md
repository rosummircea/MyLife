# Transaction category badges

Transaction list rows show the root category's full symbol on its solid configured background. The root name is shown in a rounded chip beside the icon, using the same root color. It remains available through the accessible icon label and title. A subcategory is shown by name in a rounded chip using the same root background color and dark text. Direct root allocations show the icon and root-name chip. Repeated splits for the same category do not duplicate badges. Unknown/unallocated portions retain explicit neutral labels.

Shared `TransactionsList` presentation applies to daily transactions, account history and report contribution lists. Category management, reporting charts, transaction amounts and stored allocation data remain unchanged. No schema or data mutations.

Modified files: `components/TransactionsList.tsx`, `components/TransactionsList.css` and this documentation.

Validation: production build and standalone TypeScript; browser fixtures at 1280/390/320 px check root symbols, root-name chip, subcategory chip colors, direct category allocations, repeated split allocations, uncategorized transactions and horizontal overflow.

The category and subcategory chips wrap on narrow screens to keep long names readable.
