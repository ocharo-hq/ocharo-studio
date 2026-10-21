# Frontend guidelines

*Last updated: 2026-10-21*

Apply shared frontend conventions with Vue 3 Composition API patterns and the Vue SDK.
Use a central 3D stage surrounded by floating island panels, a left library, and a contextual top toolbar.
Places render inside the Ocharo frame (`bootstrap/AppLayout.vue`); a place lends the frame its bar controls by
teleporting into the bar slot and registers its settings and unsaved-work hold through `bootstrap/StudioFrame.ts`.
Editor layout steps are `@container studio` queries; the frame bar, toasts and dialogs keep viewport media queries.
Frame glass is the SDK `ocharo` theme's: `variant="glass"` on the bar and sidebar, `variant="glass-menu"` on menus,
and `surface-glass*` with `border-glass-edge` on other chrome; Studio keeps no glass of its own.
Keep serializable design state separate from Three.js objects; dispose replaced renderer resources.
Give large icon controls accessible names, visible selection states, and keyboard access.
Rotate and offset the selected part's texture independently from camera navigation.
Use the frozen pnpm lockfile and the declared package-manager version.
