# CEREIPO.md — Códigos en la rama `Cereipo`

> **Léelo antes de tocar el repositorio si estás en la rama `Cereipo`** (o en
> una rama que salió de ella). Describe a dónde va Códigos; `IA_CONTEXT.md`,
> `ARCHITECTURE.md` e `INTEGRATION.md` describen cómo funciona **hoy** en
> PALDACA Suite. Revisado: 2026-11-05.

## 1. Qué pasa en esta rama

Códigos (`codigos`) se **migra a la suite Cereipo** (D-26). La rama `Cereipo`
es la línea de trabajo de esa migración; **`Main` sigue siendo producción de
Paldaca** hasta la ventana coordinada de la tarea 5.7.

| Rama | Qué es | Reglas |
|---|---|---|
| `Main` | Producción de Paldaca (`codigos.cpaldaca.com`) | **Congelada para cambios funcionales** desde el 05/11 (tarea 0.2). Solo correcciones urgentes, que se pasan también a `Cereipo` |
| `Cereipo` | Hace de `dev` para Cereipo | Las ramas de tarjeta `f5/<tarjeta>` salen de aquí y vuelven por PR |

## 2. Qué cambia (F5 · 03/12 – 16/12)

| # | Tarea | Lo que deja de ser cierto en `IA_CONTEXT.md` |
|---|---|---|
| 5.1 | Base **PostgreSQL propia** (`cereipo_codigos`), cookie propia y kit `cereipo-sso`; quitar el SSO de Paldaca | Ya no hay MySQL compartida, `core_*` del Portal, cookie `paldaca_sessionid` ni `DJANGO_SECRET_KEY` compartida |
| 5.2 | Organización y catálogos en datos (proyecto, subproyecto, departamento, disciplina, tipo) | Los catálogos dejan de estar fijos en el código |
| 5.3 | Contador con bloqueo y servicio `generar-codigos`: reservar en lote, confirmar, anular, repetible sin duplicar | Primer servicio declarado entre apps (D-16): lo llama Control documental |
| 5.4 | (Shell) servicios declarados: credencial por servicio y bitácora | — |
| 5.5 | Publicar los catálogos como datos maestros | Control documental los consume (D-17: Códigos es dueño de códigos y catálogos) |
| 5.6 | Renombrar la app `documentos` → `registro` y aplicar el manifiesto | Evita confundirla con Control documental (`documentos`) |
| 5.7 | Migrar el historial desde MySQL (conteo y duplicados verificados) en una ventana coordinada con Paldaca | — |

**Contrato de `generar-codigos`:** se acuerda el 03/12 con Control documental.
Hasta el 15/12, Control documental trabaja contra una versión simulada. Todo
cambio a ese contrato exige revisión cruzada A ↔ B.

## 3. Reglas en esta rama

1. Toda la arquitectura nueva sigue la documentación de la suite, en el repo
   **Cereipo Shell** (<https://github.com/Paldaca/Cereipo-Shell>):
   `docs/AI_CONTEXT.md`, `docs/suite/contratos.md`,
   `docs/suite/guia-integrar-aplicacion.md` y `docs/planificacion/plan-por-fases.md` (F5).
2. La estructura objetivo es la de la **app plantilla** de Cereipo
   (`backend/`, `frontend/`, `backend/config/db.py`).
3. Base y Redis solo por `DATABASE_URL` y `REDIS_URL` (D-31). En local:
   `iniciar.ps1` del Shell (`docs/entorno-local.md`), puertos API 8102 · web 5192.
4. Ninguna regla de negocio de `BUSINESS_RULES.md` se pierde en la migración:
   si cambia, se documenta.
5. Hasta que la tarea correspondiente se haga, el código de esta rama sigue
   siendo el de Paldaca: no asumir lo que dice la §2 sin verificar el código.
