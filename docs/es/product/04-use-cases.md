# Casos de uso

Escenarios reales donde el visor cambia la conversación.

## 1. Depurar un subagente que falla

Una tarea la lanza un subagente y termina en `failed`. Seleccionás el nodo en el
grafo, abrís el inspector y ves modelo, herramientas, todos y el error. Desde
el historial completo navegás al padre para entender qué le pidió.

**Antes:** buscar el error en el texto del terminal.
**Ahora:** el nodo en rojo te lleva directo a la causa.

## 2. Entender por qué una sesión se quedó quieta

La ejecución no avanza. El grafo resalta el nodo en `waiting-permission` o
`waiting-input`; la sección de esperas te muestra el motivo del permiso o la
pregunta pendiente con sus opciones.

**Antes:** no saber si está pensando o esperándote.
**Ahora:** ves exactamente dónde te necesita.

## 3. Auditar el costo de una sesión larga

Abrís el resumen de sesión: contadores de estado, costo y tokens acumulados
(entrada/salida/razonamiento/caché) y tiempo transcurrido. Comparás agentes para
ver dónde se fue el presupuesto.

**Antes:** descubrir el costo al final.
**Ahora:** verlo mientras ocurre.

## 4. Ver a SddOrch (o cualquier orquestador) en acción

Lanzás un flujo SDD y observás las fases, las tandas de implementación en
paralelo y cómo cada subagente aparece y se resuelve en el grafo.

**Antes:** confiar en que el orquestador hizo lo correcto.
**Ahora:** verificarlo con tus ojos.

## 5. Detectar loops y reintentos

Un agente reintenta el proveedor una y otra vez. La vista de loops marca el
patrón con evidencia (conteo de invocaciones y reintentos), así cortás a tiempo.

**Antes:** notarlo cuando ya consumió de más.
**Ahora:** detectarlo apenas se forma.

## 6. Revisar el impacto en el repo antes de commitear

La sección de impacto lista archivos cambiados con estado y líneas
sumadas/removidas, y el patch por archivo.

**Antes:** `git diff` a mano, sin contexto de qué agente lo hizo.
**Ahora:** el impacto junto a la ejecución que lo produjo.

## 7. Enseñar o demostrar ejecuciones multi-agente

Proyectás el grafo en vivo mientras un flujo corre: se ve la delegación, el
paralelismo y los cambios de estado.

**Antes:** describir el comportamiento con diapositivas.
**Ahora:** mostrarlo en vivo.
