# Overlays Speckit — MacroGest / Blendverse

Plantillas con política del proyecto que **no** deben vivir en `.specify/templates/`
(para permitir `specify upgrade` sin perder customizaciones).

`@develop` referencia estos archivos en el sufijo de prompt de las Fases 3 y 4 al invocar
`@speckit-plan` / `@speckit-tasks`.

Tras `specify upgrade`, si `.specify/templates/` fue sobrescrito con stock, estos overlays
siguen disponibles aquí.
