# Transaction category badges

Each allocation is shown in a single solid-color pill containing the root category symbol and text `Category → Subcategory`. Direct root allocations show only its symbol and name. The pill inherits the root color, uses dark text, and keeps long names readable on narrow screens. Repeated splits for the same category do not duplicate pills; unknown or unallocated amounts retain a neutral label.

Shared TransactionsList presentation applies to daily transactions, account history and report contribution lists. Stored allocations, amounts and charts are unchanged.

Category management opens with all branches collapsed; independent expansion and Collapse all remain available. New roots also default to collapsed. The New category action sits on the right directly above the category tree. Add transaction is visible only on the Transactions tab, below the calendar and daily summary, directly above the transaction list.

Modified files: components/CategoriesWorkspace.tsx, components/MyLifeApp.tsx, components/TransactionsList.tsx, components/TransactionsList.css and this documentation.

Validation: production build and standalone TypeScript; browser fixtures at 1280/390/320 px check unified symbols/text/colors, allocation deduplication, unallocated labels, action placement, default collapse, expansion and Collapse all, and horizontal overflow.
