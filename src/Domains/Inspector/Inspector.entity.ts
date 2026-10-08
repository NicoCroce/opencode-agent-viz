/**
 * Barrel de tipos del dominio Inspector.
 *
 * Los tipos se reparten por preocupación: preguntas/permisos
 * (`InspectorQuestions.entity`), sesión/diff/tareas/resumen
 * (`InspectorSession.entity`) y recursos (`InspectorResources.entity`). Este
 * archivo re-exporta todos para preservar la API pública que consumen el resto
 * del dominio, `Graph` y `WorkspacePage` (importan desde `Inspector.entity`).
 */
export * from './InspectorQuestions.entity';
export * from './InspectorSession.entity';
export * from './InspectorResources.entity';
