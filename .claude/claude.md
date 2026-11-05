# Instrucciones para Claude / asistentes de IA — Codigos

## Obligatorio antes de escribir código

> **En la rama `Cereipo`** (migración a la suite Cereipo), lee primero
> **`docs/CEREIPO.md`**: dice qué partes de estos documentos dejan de valer.

1. Leer **`docs/IA_CONTEXT.md`**.
2. Según la tarea, consultar:
   - `docs/ARCHITECTURE.md`
   - `docs/BUSINESS_RULES.md`
   - `docs/INTEGRATION.md`
3. Solo después, explorar el código afectado e implementar.

## Qué es este repo

Satélite **Códigos** (`MODULO_CODIGO = codigos`). Django server-rendered en `codigos.cpaldaca.com`. Generación, búsqueda y anulación de códigos documentales. Login en **Portal-Paldaca** (SSO).

## Reglas duras

- No implementar login local; SSO con cookie `paldaca_sessionid`.
- No divergir `core_*` respecto al Portal.
- Tablas de negocio con prefijo **`codigos_`**.
- Misma `DJANGO_SECRET_KEY` y MySQL que Portal.
- Permiso **aprobador** de solicitudes: alinear con contrato Portal `/auth/me/` (`permisos.codigos.aprobador`).
- No inventar APIs REST entre satélites; integración por BD + SSO + nav.
- Gate: `tiene_acceso_modulo("codigos")`.

## Orden de lectura por tarea

| Tarea | Leer primero |
|-------|----------------|
| Generar / listar códigos | `IA_CONTEXT` → `BUSINESS_RULES` → `documentos/` |
| Anulaciones / solicitudes | `BUSINESS_RULES` → vistas de anulación |
| SSO / nav | `INTEGRATION` → `core/` |
