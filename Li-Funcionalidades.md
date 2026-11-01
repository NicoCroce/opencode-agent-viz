# OpenCode Agent Viz: Observabilidad en Tiempo Real para Sistemas Multi-Agente

## 🎯 El Problema

¿Alguna vez intentaste debuggear una ejecución con múltiples agentes interactuando simultáneamente? 🤔

La coordinación entre agentes es poderosa pero opaca. Sin visibilidad clara, es imposible entender:
- ¿Qué hizo cada agente exactamente?
- ¿En qué orden se ejecutaron las tareas?
- ¿Dónde se ralentizó el flujo?
- ¿Qué pasó cuando algo falló?

Resultado: debugging que se parece más a adivinar que a investigar.

---

## ✨ La Solución: OpenCode Agent Viz

Una herramienta de **observabilidad en tiempo real** diseñada específicamente para **visualizar y entender la ejecución de sistemas multi-agente**.

### 🚀 Funcionalidades Clave

**1. Visualización en Grafo en Tiempo Real**
- Observa el flujo de ejecución de agentes como un grafo interactivo
- Cada nodo representa un agente; cada conexión muestra quién llamó a quién
- Layout automático con dagre para máxima claridad, incluso con decenas de nodos

**2. Inspector de Ejecución**
- Selecciona cualquier nodo en el grafo y accede a:
  - Herramientas invocadas y sus resultados
  - Parámetros exactos enviados
  - Razonamiento y decisiones del agente
  - Tiempos de ejecución y estados
  - Errores y detalles de depuración

**3. Streaming de Eventos en Vivo**
- Suscripción SSE (Server-Sent Events) a las ejecuciones del servidor OpenCode
- Updates instantáneos: ve cómo evoluciona el grafo segundo a segundo
- Reconexión automática con backoff exponencial

**4. Gestión de Sesiones**
- Lista todas tus ejecuciones de agentes
- Filtra por proyecto, recencia o estado
- Acceso rápido a sesiones activas e históricas
- Detalles de metadatos: agentes involucrados, duración total, resultado

**5. Optimización para Rendimiento**
- Batching inteligente de eventos para evitar re-renders innecesarios
- Queries cacheadas con TanStack Query 5
- UI fluida incluso bajo alto volumen de eventos
- Compatible con proyectos grandes y ejecuciones complejas

**6. Interfaz de Solo Lectura**
- Observa sin interferir: la herramienta **nunca modifica** la ejecución de agentes
- Perfecta para auditoría, debugging y análisis post-mortem
- Acceso seguro sin riesgos de efectos secundarios

---

## 💡 Para Quién

- **Ingenieros de IA & LLM Ops**: Dominan multi-agent systems y necesitan visibilidad
- **Equipos de Data Science**: Monitorean flujos orquestados y canalización de datos
- **DevOps & SRE**: Auditan ejecuciones y resuelven issues en producción
- **Startups de IA**: Desarrollan productos con agentes complejos y necesitan debugging sólido

---

## 🛠️ Stack Moderno

Construido con tecnología frontend de punta:
- **React 19** + **Vite 8** para máxima velocidad
- **React Flow** para visualización de grafos interactivos
- **TanStack Query 5** para gestión de estado y caché
- **Tailwind 4** + **shadcn/ui** para interfaz pulida
- **TypeScript strict** para seguridad de tipos

---

## 🔗 Conecta Tu Servidor OpenCode

La herramienta se conecta a cualquier servidor OpenCode en ejecución:
```
http://localhost:3000
```

Perfecto para desarrollo local, staging o producción. Simple, rápido, lista para usar.

---

## 📊 Casos de Uso Reales

✅ **Debugging de fallos**: Navega exactamente dónde falló la cadena de agentes  
✅ **Optimización de latencia**: Identifica cuellos de botella en parallelización  
✅ **Auditoría de decisiones**: Examina el razonamiento de cada agente paso a paso  
✅ **Training & onboarding**: Aprende cómo funciona tu orquestación de agentes  
✅ **Análisis post-mortem**: Reconstruye qué sucedió en producciones fallidas  

---

## 🎬 Próximos Pasos

1. **Conéctate** a tu servidor OpenCode
2. **Visualiza** la próxima ejecución de agentes en vivo
3. **Inspecciona** cada nodo con un solo clic
4. **Entiende** tu sistema multi-agente como nunca antes

---

## 📫 Quiero Saber Más

¿Estás construyendo con agentes y necesitas mejor visibilidad? 

→ Explora OpenCode Agent Viz hoy  
→ Contribuye en [repositorio GitHub]  
→ Únete a la comunidad OpenCode

**Porque los sistemas multi-agente merecen observabilidad de clase mundial.**

**Importante**

_Este proyecto es un laboratorio para coordinar la ejecución de múltiples agentes utilizando un harness propio con fundamentos ya establecidos en el mercado. El modelo utilizado es 𝙙𝙚𝙚𝙥𝙨𝙚𝙚𝙠-𝙫𝟒.𝟏-𝙛𝙡𝙖𝙨𝙝. para dar la posibilidad a que cualquier persona pueda desarrollar algo decente a un costo accesible. No dudo que utilizando modelos de frontera el desarrollo sería más rápido y preciso, pero el objetivo de esta prueba no era ese._

---

*OpenCode Agent Viz: Visualiza. Entiende. Optimiza. 🚀*
