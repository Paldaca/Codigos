# CEREIPO.md — Códigos en la rama `Cereipo`

> Guía de transición y operación de **Códigos** dentro de la suite **Cereipo** (D-26, Fase 5).
> La rama `Main` permanece congelada como producción de PALDACA (`codigos.cpaldaca.com`).

## 1. Ramas

| Rama | Qué es | Reglas |
|---|---|---|
| `Main` | Producción de PALDACA (`codigos.cpaldaca.com`) | **Congelada** para cambios funcionales hasta el corte coordinado de la tarea 5.7 |
| `Cereipo` | Rama principal de integración en Cereipo | Contiene el backend modular en 5 apps Django, PostgreSQL + RLS, SPA React y el servicio `generar-codigos` |

## 2. Estado de tareas de la Fase 5

| Tarea | Alcance implementado | Ubicación principal |
|---|---|---|
| **5.1** | Base PostgreSQL propia (`cereipo_codigos`), Redis propio, RLS activo en todas las tablas de organización, `cereipo-sso` `>=0.5.0`, manifiesto `/.well-known/cereipo-app.json` y `/salud/` | `backend/config/`, `backend/integracion/` |
| **5.2** | `ConfiguracionOrganizacion` (sigla fija por organización) y `CatalogoSegmento` editable en datos (`proyecto`, `subproyecto`, `departamento`, `disciplina`, `tipo_documento`) + siembra estándar PALDACA | `backend/catalogos/` |
| **5.2b** | Catálogo original como plantilla inicial personalizable por organización (manteniendo el esquema único de 8 segmentos), `InstantaneaCatalogo` con RLS, reversión puntual o por instantánea, restablecimiento a plantilla y pantalla interactiva de esquema | `backend/catalogos/`, `frontend/src/pages/catalogos/` |
| **5.3** | `ContadorSecuencia` con `select_for_update()`, flujo manual (previsualizar → confirmar/generar), idempotencia, anulación directa y solicitudes de anulación, y API declarada `codigos/generar-codigos` | `backend/registro/`, `backend/api/` |
| **5.4** | (En **Cereipo Shell** + **Cereipo Kit** `0.5.0`) Modelos D-16 (`ServicioDeclarado`, `AutorizacionServicio`, `CredencialServicio`, `BitacoraServicio`), endpoints de firma/verificación y UI de autorización en Catálogo | `Cereipo Shell/backend/{catalogo,accesos}`, `Cereipo Kit/python/cereipo_sso/` |
| **5.5** | Publicación y sincronización de `codigos.catalogos` como dato maestro (`maestros` del Shell + `cereipo_sso.maestros`) | `backend/catalogos/services/publicacion.py`, `backend/integracion/management/commands/sincronizar_maestros.py` |
| **5.6** | Renombre definitivo a `registro` (evitando colisión con `documentos` = Control de Documentos), SPA React embebida (`@cereipo/embed` + `@cereipo/ui`) y separación en 5 apps con `import-linter` (D-19) | `backend/registro/`, `frontend/` |
| **5.7** | Comando idempotente `manage.py migrar_desde_mysql` para migrar `Empresa` -> `Organizacion`, historial, solicitudes e inicializar `ContadorSecuencia` en `MAX(consecutivo)` durante la ventana de corte | `backend/registro/management/commands/migrar_desde_mysql.py` |

## 3. Reglas operativas en local y despliegue

- **Infraestructura compartida**: `DATABASE_URL` hacia `cereipo_codigos` y `REDIS_URL` (`db 2` en `infra/local/apps.json` del Shell). Puertos locales: API `8102`, web `5192`.
- **Migraciones**: nunca se ejecutan al arrancar la app; se corren previamente con `python manage.py migrate --noinput`.
- **Paquetes privados JS (`@cereipo/embed`, `@cereipo/ui`)**: en CI/Docker se resuelven desde `https://npm.pkg.github.com` con `kit_token` / `CEREIPO_KIT_TOKEN`. Si en un entorno local sin token de GitHub Packages falta la publicación de `@paldaca/cereipo-embed`, el desarrollo local puede vincular los `dist/` compilados de `Cereipo Kit/js/packages/{embed,ui}` dentro de `frontend/node_modules/@cereipo/`.
