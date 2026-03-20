# Agent Memory

## Learned User Preferences

- When user requests persisting CSS changes from browser preview to source, apply each change using the selector, property, oldValue, and newValue from the payload; locate elements via selector/elementClasses/elementPath and modify the corresponding JSX, CSS, or inline styles
- When user provides a DOM path and says "remove this" or "remove these", remove the specified element(s) from the source code

## Learned Workspace Facts

- ft-design-system Button has no tertiary variant; use variant="text" for lowest-emphasis icon-only buttons
- Workspace uses rem14 (14px base) for spacing via `@/lib/rem`
