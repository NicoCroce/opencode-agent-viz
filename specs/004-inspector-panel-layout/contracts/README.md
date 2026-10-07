# Contracts — Reordenar y agrupar el panel de detalles

Contratos de interfaz que esta feature expone. Como es una app de solo frontend cuya
"interfaz pública" es la **UI**, los contratos describen la composición del panel, el
comportamiento del desplegable y las props de los componentes nuevos, además de los
criterios verificables.

| Documento | Cubre | FR |
|-----------|-------|----|
| [inspector-layout-contract.md](./inspector-layout-contract.md) | Orden de secciones, subsecciones de "Avanzado", contrato del disclosure y props de los componentes nuevos. | FR-001..FR-016 |

No hay contratos de API/endpoints: la feature **no** consume ni expone interfaces de red nuevas
(ver Assumptions de la spec).
