# Agent Memory

## Learned User Preferences

- When user requests persisting CSS changes from browser preview to source, apply each change using the selector, property, oldValue, and newValue from the payload; locate elements via selector/elementClasses/elementPath and modify the corresponding JSX, CSS, or inline styles
- When user provides a DOM path and says "remove this" or "remove these", remove the specified element(s) from the source code
- For dense header filter rows (e.g. ePOD vs Figma), keep controls on one line where specified: avoid flex-wrap on the filter cluster, use flex-nowrap with min-w-0 on segments that should shrink (including combined select + search), and place trailing header content in a flex-1 min-w-0 wrapper so the row can compress before wrapping
- Prefer ft-design-system components for filters and inputs (e.g. DatePicker, Select) instead of customized stand-ins; match border radius and scale to the DS reference control in the same row unless a segmented combo layout explicitly calls for different corners
- For ePOD review KPI or metric tiles, selected state should change background only, not add a border
- When a link-style control sits inside another clickable region (e.g. dropzone), use `Button variant="link"` and call `stopPropagation()` on its click handler so the parent does not fire twice

## Learned Workspace Facts

- ft-design-system has no tertiary button variant; use variant="text" for lowest-emphasis icon-only actions and variant="secondary" for outlined icon-only controls (secondary is the outlined style in this DS)
- Workspace px-to-rem uses `@/lib/rem` with a 16px root; the rem14 name is a legacy alias and does not mean a 14px root
- In ft-design-system data tables, header label color is often driven by the table header item / inner label APIs (e.g. colorVariant), not only by setting color on the th element
- ft-design-system AppHeader does not bundle a full theme switcher by default; use ThemeSwitch for dedicated theme UI, or wire AppHeader showThemeIcon and onThemeIconClick if a compact header affordance is needed
- Many ft-design-system components merge `className` last (e.g. via `cn()`); add utilities such as `font-semibold` or `text-md` on the component to override default typography when the implementation lives in node_modules; `BreadcrumbLink` defaults to `font-medium` (500) on the anchor, so pass `font-semibold` when the design calls for 600 weight
- ePOD process drawer overview fields and shipment-vs-OCR comparison row labels are defined in `src/components/epod/process/epodOverviewSections.ts`; update labels there so both views stay aligned
- ft-design-system `ModalContent` may apply an inline width (e.g. `32.5rem`); use a width utility with the Tailwind important modifier, such as `!w-[min(1200px,96vw)]`, when the modal must be wider than the default
- ft-design-system `TableCell` may not apply arbitrary `style` on the underlying `<td>` as expected (e.g. borders); prefer `className` with border utilities for cell borders and similar visual overrides
- `TableRow` uses `group/table-row`; when row hover uses a `--border-secondary` background but `TableCell` keeps a bottom border on `--border-primary`, add `group-hover/table-row:border-b-[var(--border-secondary)]` on cells so the bottom border matches the hover surface
