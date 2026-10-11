# Contrato — Panel de chat, pestañas y accesibilidad

**Feature**: `009-interactive-chat`
**Cubre**: FR-008, FR-012, FR-013, FR-014, FR-015, FR-021 · SC-006, SC-007, SC-008
**Implementa**: `Application/Components/ui/tabs.tsx` (reuso Radix Tabs), `ui/sonner.tsx` (theme dark),
`ui/{button,input,textarea,select,checkbox}.tsx` (foco/forced-colors),
`Application/Components/Molecules/{ChatComposer,ChatSelector,ChatPendingRequest,ChatAttentionBanner}.tsx`,
`Domains/Chat/Components/{ChatPanel,ChatTimeline}.tsx`,
`Infrastructure/Hooks/useDetailTabs.ts`, `Infrastructure/Components/{WorkspaceLayout,WorkspaceMobileTabs,InspectorPane}.tsx`,
`Infrastructure/WorkspacePage.tsx`, `WorkspacePage.constants.ts`, `src/index.css`.

---

## 1. Pestañas Detalle|Chat (FR-008, FR-012)

- **Desktop**: la columna del detalle se envuelve en **Radix Tabs** con `Detalle | Chat` (patrón APG: `role=tablist`, `role=tab`, `role=tabpanel`, `aria-controls`/`aria-labelledby`, navegación con flechas, roving tabindex). Estado en `useDetailTabs`.
- `ChatPanel` compone, de arriba a abajo: **bandeja de pendientes** (`ChatPendingRequest`) + **banner** (`ChatAttentionBanner`) sobre el **timeline** (`ChatTimeline`) y el **composer** (`ChatComposer` con `ChatSelector`).
- **Estados de pantalla obligatorios (FR-012/Principio VI)**: error → carga → vacío → datos, con `EmptyScreenError`/esqueleto/`EmptyState`. Si el stream está `disconnected`/`reconnecting` (`useEventStream`), se **avisa** de que la respuesta en vivo puede no llegar aunque el envío se realice.

## 2. Móvil de primer nivel (FR-013/FR-014)

- `WORKSPACE_TABS = ['sessions','graph','inspector','chat']`; `WorkspaceMobileTabs` renderiza `ChatPanel` como panel **propio**.
- En móvil **no** se monta el tablist interno Detalle|Chat (evita tabbars anidadas).
- Una sola fuente de lógica (`useChatController`) alimenta desktop y móvil (FR-014); prohibido `md:hidden`/`hidden md:block`.

## 3. Selectores (FR-008)

- `ChatSelector`: agente (`useGetAgents`), modelo (`listModels`) y razonamiento (`mapModelOptions`).
- La variante de razonamiento **solo** contiene las del modelo elegido; modelo sin variantes → lista vacía y envío funcional.
- Al enviar, si la selección cambió se aplica `switchAgent`/`switchModel` **antes** de `sendPrompt` (ver `write-facade-contract §1`).

## 4. Borrador (FR-015)

- `useChatDraft(sessionId)` persiste el texto en `localStorage` (`chat.draft.<sessionId>`) y lo rehidrata al montar.
- Sobrevive al cambio de pestaña/vista (el panel móvil se desmonta) y a la rotación (SC-006).
- Enter envía, Shift+Enter inserta salto de línea, y se respeta el estado de composición IME.

## 5. Escape y foco

- El `Escape` del composer cancela solo el estado inline (p. ej. bandeja) y **no** cierra el fullscreen ni limpia la selección; `WorkspacePage` da prioridad "cerrar fullscreen" > "limpiar selección".

## 6. Accesibilidad WCAG 2.2 AA (FR-021, SC-008)

- Operable por teclado; foco visible; sin trampas de foco.
- Contraste ≥4.5:1 (texto) y ≥3:1 (UI no textual).
- Roles ARIA correctos; `aria-busy` en Enviar/Detener; `role="status"` para el anuncio de inicio/fin de turno (**no** por delta); badges con `aria-label`.
- **Correcciones repo-wide**: `--destructive` dark y `--status-idle` como texto a contraste suficiente; foco migrado de `box-shadow`/`ring` a `outline` con `@media (forced-colors)` en `ui/{button,input,textarea,select,checkbox}.tsx`; `ui/sonner.tsx` con `theme="dark"` fijo.

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| P1 | Detalle\|Chat son tablist/tab/tabpanel; flechas navegan; roving tabindex | spec de `ui/tabs`/`InspectorPane` |
| P2 | `ChatPanel` renderiza error→carga→vacío→datos | spec de `ChatPanel` |
| P3 | Con stream desconectado se muestra el aviso al enviar | spec de `ChatPanel` |
| P4 | En móvil el chat es un tab de primer nivel sin tablist anidado | spec de `WorkspaceMobileTabs`/`WorkspaceLayout` |
| P5 | El borrador sobrevive al cambio de tab y al remontaje | spec de `useChatDraft` |
| P6 | La variante de razonamiento se acota al modelo; sin variantes el envío sigue | spec de `ChatSelector`/`mapModelOptions` |
| P7 | Envío/Detener comunican `aria-busy`; el anuncio es de inicio/fin | spec de `ChatComposer` |
| P8 | Foco visible en forced-colors y contraste de tokens corregido | spec/inspección de `ui/*` + `index.css` |
