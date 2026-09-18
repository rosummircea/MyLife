# Fluid category reordering and inherited markers

Reorder categories and sibling subcategories using the grip handle with mouse or touch. Pointer events use window listeners throughout the gesture because relocating a DOM node can lose pointer capture. A floating copy follows the pointer, with a dashed shadow marking the insertion slot and a target-position caption. List order stays unchanged during the gesture. On release, application state updates immediately and saves are serialized through the existing authenticated `finance_reorder_categories` RPC. Rapid successive moves remain available during saves. Failed latest saves restore the last confirmed sibling order and show an error. Keyboard users can focus the handle and press Up/Down/Home/End; a live region announces position. Touch action is disabled only on the grip so the rest of the page still scrolls normally.

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

## Expand/collapse

Roots with children have a toggle on their name and chevron, with `aria-expanded` and `aria-controls`. Each branch opens independently; all start expanded. Collapsed state survives reordering and switching category kinds while the workspace is mounted. Hidden children retain their hierarchy and stored order. Roots without children show their name normally. Enter/Space and mouse/tap work on the native toggle button. Verified at 1280/390/320 px, including collapsed-root reordering and keyboard expansion. Implementation changed only `components/CategoriesWorkspace.tsx` and its CSS, plus this documentation.

The “Restrânge toate” button closes every root branch in the displayed category kind. It becomes disabled when no expanded branches remain and becomes available again after an individual expansion. Other category kinds keep their state. Desktop/mobile browser fixtures verify both closed branches and the button state.


The floating row is rendered in a portal with no pointer interaction, preserving category color and child-count context. Its original branch is faded during drag. Only siblings are valid insertion targets; root moves keep children attached. Edge scrolling continues while the gesture remains near the viewport edge. Escape, pointer cancellation and window blur cancel without changing order or saving. Browser fixture verification covers skipping three root categories, unchanged order before release, insertion shadow and ghost removal, native browser-generated touch gestures at 390/320 px, Escape, rapid serialized saves and rejected-save rollback. Build, TypeScript and all 63 unit tests passed. This update modifies the workspace TSX/CSS, `components/useCategoryReorder.ts` and this document only.
