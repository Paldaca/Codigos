# IA_CONTEXT.md — Contexto condensado para asistentes de IA

> Leer este archivo al inicio de una sesión sobre el repo **Códigos**.  
> No implementar cambios basándose solo en suposiciones: verificar el código citado.  
> Documentación hermana: `ARCHITECTURE.md`, `BUSINESS_RULES.md`, `INTEGRATION.md`.

---

## Objetivo

Módulo Django de **PALDACA Suite** para **generar, buscar y anular códigos documentales** corporativos. Host: `codigos.cpaldaca.com`. No es el Portal Shell; autentica vía **SSO compartido**.

---

## Arquitectura (ultra breve)

- Django 5.2 monolítico server-rendered (Bootstrap CDN).
- Apps: `core` (identidad Suite + SSO middleware) + `documentos` (dominio).
- BD MySQL **única** de la Suite (`codigos/db.py` → `ssapmcco_PALDACA_DB`).
- Sin DRF / sin React propio.
- Navegación embebida del Portal (`paldaca-nav.js/css` + API Portal).

---

## Módulos principales

| App | Qué hace |
|---|---|
| `core` | `UsuarioPaldaca`, módulos, middleware de revisión de sesión, redirects SSO, home |
| `documentos` | Formularios, generación, listado, búsqueda, anulación, emails |
| `codigos` | Proyecto: settings, urls raíz, wsgi, db |

Identificador de módulo Suite: **`codigos`**.

---

## Modelos importantes

**Dominio (tablas `codigos_*`):**

- `Empresa` — sigla, nombre, `correo_notificacion`
- `CodigoGenerado` — código único, segmentos, motivo, usuario, flags de anulación
- `SolicitudAnulacion` — motivo, procesada; permiso custom `puede_anular_codigo`
- `ContadorCodigo` — **existe, no usado en vistas**

**Suite (`core_*`):**

- `UsuarioPaldaca` (`AUTH_USER_MODEL`, tabla `core_usuario`)
- `Modulo` / `UsuarioModulo` — gate de acceso
- `Disciplina` / `Perfil`
- `Role` / `UserRole` / `GoogleDriveToken` — tablas `calidad_*` (espejo; sin uso local)
- Campos HDT en usuario — sin uso local

---

## Flujo principal

1. Usuario llega con cookie `paldaca_sessionid` (Portal).
2. `@requiere_modulo_paldaca` exige `tiene_acceso_modulo("codigos")`.
3. Generar: preview en sesión → confirmar con motivo → `CodigoGenerado` → email a empresa.
4. Formato: `{SIGLA}-{AA}-{NN}-{S}-{DEPT}-{DISC}-{TIPO}-{CCC}` con `CCC = count(misma combinación)+1`.
5. Anular: creador o aprobador; o solicitud → bandeja de aprobadores.

Rutas clave: `/`, `/generar_codigo/`, `/Codigos/`, `/BuscarCodigo/`, `/anular_codigo/<id>/`, `/solicitar_anulacion/<id>/`, `/solicitudes_anulacion/`, `/historial_anulaciones/`.  
`/Login|/Register|/Logout` → redirects SSO.

---

## Reglas de negocio críticas

1. Acceso solo con módulo `codigos` (o superuser).
2. Motivo obligatorio al guardar.
3. Código único; consecutivo por COUNT (no por `ContadorCodigo`).
4. Aprobador = admin del módulo **o** permiso `documentos.puede_anular_codigo`.
5. Backend permite anular al **creador**; UI lista usa solo el permiso Django (inconsistencia).
6. Fallo de email no deshace el código guardado.
7. Sesión se invalida si cambia `get_auth_revision()` (strict mode).

Detalle: `BUSINESS_RULES.md`.

---

## Dependencias importantes

- Misma `DJANGO_SECRET_KEY` y cookie domain que Portal (`key.env`).
- `PALDACA_SSO_LOGIN_URL` / `PALDACA_SSO_LOGOUT_URL`.
- Assets/API Portal: `cpaldaca.com` / `api.cpaldaca.com` (o localhost:8000 / :5173 en DEBUG).
- SMTP local del dominio Códigos (`correo.env` → `EMAIL_HOST_PASSWORD`).
- `requirements.txt`: Django 5.2.4, mysqlclient, PyMySQL, dotenv, widget-tweaks.

**Inconsistencia:** `key.env.example` define `MYSQL_*`, pero `codigos/db.py` hardcodea credenciales y no las usa.

---

## Integraciones con otros repos

| Repo | Relación |
|---|---|
| Portal-Paldaca | SSO, logout API, nav CSS/JS/API, secretos compartidos, bus de notificaciones (POST firmado al solicitar anulación — `documentos/avisos.py`) |
| Activos / Calidad / HDT | Misma BD + `core_*` + sesión; **sin API directa** con Códigos |
| Calidad | Modelos espejo `calidad_*` en migraciones de este repo |
| HDT | Columnas timesheet en `core_usuario` |

Ver `INTEGRATION.md`.

---

## Convenciones

- Prefijo tablas dominio: `codigos_` vía `TABLA()` en `documentos/constants.py`.
- Locale: `es-ve`, TZ `America/Caracas`.
- Logging rotativo en `logs/` (`documentos`, `core`).
- Decorador de acceso: `@requiere_modulo_paldaca`.
- Aprobación: `es_aprobador_codigos(user)`.
- Deploy: GitHub Actions → rama `Main` + Passenger; también `.cpanel.yml`.
- Responder/documentar en español en este ecosistema.

---

## Archivos críticos

```
codigos/settings.py
codigos/db.py
core/models.py
core/middleware.py
core/session_logout.py
core/context_processors.py
documentos/models.py
documentos/views.py
documentos/forms.py
documentos/permissions.py
documentos/decorators.py
documentos/constants.py
key.env.example
```

---

## Riesgos conocidos

- `DEBUG = True` fijo; `ALLOWED_HOSTS` con URL mal formada.
- Credenciales DB en texto plano en `db.py`.
- Race condition posible en consecutivos (`count+1` sin lock; unique + IntegrityError como red de seguridad).
- Drift de esquema Suite si se migran `core`/`calidad_*` solo desde este repo.
- UI vs backend en anulación (permiso Django vs creador/admin módulo).
- `ContadorCodigo` legacy confunde; no usarlo sin verificar.
- Dos pipelines de deploy (CI vs cPanel) con paths distintos.
- `.gitignore` contiene `/migrations/` (arriesgado; las migraciones sí están versionadas en el árbol actual — verificar antes de asumir).

---

## Qué NO hacer / no asumir

- No inventar API REST entre módulos.
- No asumir que login vive en este repo.
- No asumir que `ContadorCodigo` gobierna el consecutivo.
- No tratar modelos Calidad/HDT aquí como lógica de negocio de Códigos.
- No cambiar `MODULO_CODIGO`, cookie SSO o `get_auth_revision` sin impacto Suite-wide.

---

## Checklist rápido antes de desarrollar

1. ¿Requiere acceso módulo `codigos`?
2. ¿Toca tablas `core_*` o solo `codigos_*`?
3. ¿Afecta SSO/cookies/secret key?
4. ¿La regla está en `views`/`permissions` o solo en template?
5. ¿Hay migración que pueda diverger de Portal/Activos/Calidad/HDT?
