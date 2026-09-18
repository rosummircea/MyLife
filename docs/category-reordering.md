# Fluid category reordering and inherited markers

Reorder categories and sibling subcategories using the grip handle with mouse or touch. Pointer events use window listeners throughout the gesture because relocating a DOM node can lose pointer capture. Preview updates application state immediately, preserving the page and scroll position. On release, saves are serialized through the existing authenticated `finance_reorder_categories` RPC. Rapid successive moves remain available during saves. Failed latest saves restore the last confirmed sibling order and show an error. Keyboard users can focus the handle and press Up/Down/Home/End; a live region announces position. Touch action is disabled only on the grip so the rest of the page still scrolls normally.

Arrow action buttons are removed. Only roots have an add-subcategory action. Parent selectors only offer roots and cannot nest a category that already has children. Subcategory forms inherit the parent's appearance and have no icon/color controls. Existing data is not flattened or migrated.

Category markers use solid configured backgrounds and consistent dark icons. Roots have descriptive icons; children have plain solid markers inheriting the root color, including older records with custom colors. Reports, transaction rows and editing pickers use this presentation. Donut slices retain their existing distinct colors for readability; their list markers inherit the parent color.

No schema changes. Public Supabase client and existing session/RLS remain in use. The existing reorder RPC was verified with an authenticated rollback query, without retaining data changes.

Validation: production build, standalone TypeScript, 63 unit tests; browser fixture checks at 1280/390/320 px cover mouse/pointer touch reorder, consecutive saves, no reload of transaction data, rejected-save rollback, inherited colors, root-only creation and no horizontal overflow.

Files changed:
- components/CategoriesWorkspace.tsx
- components/CategoriesWorkspace.css
- components/useCategoryReorder.ts
- components/CategoryIcon.tsx
- components/CategoryPicker.tsx
- components/ExpenseReport.tsx
- components/MyLifeApp.tsx
- components/TransactionsList.tsx
- lib/category-display.ts
- lib/category-reorder.ts
- tests/category-reorder.test.cjs
- docs/category-reordering.md
