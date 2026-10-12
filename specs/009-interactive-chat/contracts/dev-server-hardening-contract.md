# Contrato — Endurecimiento del dev server

**Feature**: `009-interactive-chat`
**Cubre**: FR-018 · Principio I
**Implementa**: `vite.config.ts`, `scripts/start.sh`.

---

## 1. Motivo

El proxy `/oc` **inyecta** las credenciales Basic (`opencode:<pass>`) server-side (`vite.config.ts:15-18,49-51`), por lo que el navegador no se autentica. Con la capa de escritura, "acceder al dev server" equivale a **ejecutar en la máquina del operador**. Hay que impedir que (a) el servidor quede expuesto a la LAN y (b) una web maliciosa abierta en el mismo navegador dispare peticiones de escritura (CSRF).

## 2. Controles

| Control | Dónde | Regla |
|---------|-------|-------|
| Bind loopback | `vite.config.ts` | `server.host: '127.0.0.1'` (no `0.0.0.0`). |
| Guard de origen | `vite.config.ts` (`proxy.configure`) | rechazar `proxyReq` cuyo `remoteAddress` no sea loopback. |
| Origin/Referer | `vite.config.ts` (`proxy.configure`) | aceptar peticiones solo si `Origin`/`Referer` son de loopback (`http://127.0.0.1:*`, `http://localhost:*`); si no, responder error. |
| Loopback en el arranque | `scripts/start.sh` | forzar/confirmar bind local y **documentar** el riesgo. |
| Sin host remoto | `scripts/start.sh` | no soportar `OPENCODE_URL` remoto (filtraría las creds Basic). |

## 3. No-objetivos

- **No** se introduce un toggle de escritura: la escritura queda siempre activa y se compensa con el endurecimiento (decisión `hardening-dev-server`).
- La fricción de no poder usar la web desde otra máquina de la LAN es **aceptada y documentada**.

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| H1 | El servidor arranca en `127.0.0.1` | revisión de `vite.config.ts` + arranque |
| H2 | Una petición con `Origin` externo al proxy es rechazada | spec/prueba manual del proxy |
| H3 | Una petición con `Origin`/`Referer` loopback pasa | prueba manual |
| H4 | `start.sh` documenta el riesgo y no soporta host remoto | revisión del script |
| H5 | La password nunca aparece en el bundle | revisión de `vite.config.ts` (inyección server-side) |
