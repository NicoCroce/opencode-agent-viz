# Contracts — Filtros de proyecto y recencia en el listado de sesiones

Contratos de interfaz que esta feature expone. Como es una app de solo frontend cuya
"interfaz pública" es la **UI**, los contratos describen la barra de filtros, la composición de
la página, las props de los componentes nuevos y el contrato de la **URL** (el único estado
persistente). Todos son verificables con tests de Testing Library y tests puros.

| Documento | Cubre | FR |
|-----------|-------|----|
| [session-filters-contract.md](./session-filters-contract.md) | Barra de filtros, controles, contrato de URL, props de componentes, reglas de filtrado y estados. | FR-001..FR-025 |

No hay contratos de API/endpoints: la feature **no** consume ni expone interfaces de red nuevas
(ver Assumptions de la spec). El único "contrato externo" es la forma de la dirección de la
página, documentada abajo para permitir enlaces compartibles (FR-013).
