# INTEGRATION.md — Repositorio Códigos

> Documento principal de integraciones con PALDACA Suite.  
> Toda afirmación está respaldada por el código de este repositorio. Donde la integración es solo estructural (tablas/modelos compartidos sin uso funcional local), se indica explícitamente.

---

## 1. Posición en PALDACA Suite

| Aspecto | Valor en código |
|---|---|
| Identificador de módulo | `"codigos"` (`documentos.constants.MODULO_CODIGO`) |
| Dominio productivo | `codigos.cpaldaca.com` |
| Rol en Suite | Generador/consultor de códigos documentales |
| Contenedor / Shell | **No**; consume Portal para SSO y navegación |
| BD | MySQL compartida (`ssapmcco_PALDACA_DB` en `codigos/db.py` activo) |

Repositorios hermanos referenciados en catálogo de módulos (`core` seed / `seed_core_modulos`):

| Código módulo | Nombre en seed |
|---|---|
| `portal` | Portal Paldaca |
| `calidad` | Calidad |
| `codigos` | Codigos |
| `activos` | Activos |
| `hdt` | Hoja de Tiempo |
| `ventas` / `inventario` / `rrhh` / `proyectos` | Sembrados como módulos futuros |

---

## 2. Autenticación e identidad compartida (SSO)

### 2.1 Mecanismo

- Cookie de sesión Django compartida: `SESSION_COOKIE_NAME` default `paldaca_sessionid`.
- Dominio de cookie configurable: `SESSION_COOKIE_DOMAIN` (típicamente `.cpaldaca.com` en producción).
- `AUTH_USER_MODEL = "core.UsuarioPaldaca"` → tabla `core_usuario`.
- Login/logout **no** se implementan aquí; se redirige a:

  | Setting | Default local |
  |---|---|
  | `PALDACA_SSO_LOGIN_URL` | `http://localhost:5173/login/` |
  | `PALDACA_SSO_LOGOUT_URL` | `http://localhost:8000/api/auth/sso/logout/` |

- Evidencia de dependencia con Portal: mensaje de error de `SECRET_KEY` indica copiar `key.env` desde Portal-Paldaca (misma clave y `MYSQL_*`).

### 2.2 Consistencia de sesión entre repositorios

`PaldacaSessionMiddleware` almacena en sesión:

- `paldaca_auth_revision`
- `paldaca_rol`
- `paldaca_disciplina_id`
- `paldaca_perfil_id`

Si otro sistema (p. ej. Portal admin) cambia rol/módulos/activo del usuario, Códigos cierra la sesión compartida (`close_paldaca_session` + limpieza de cookies `paldaca_sessionid`, `sessionid`, `csrftoken`).

### 2.3 CSRF / hosts de confianza

En producción (con dominio de cookie), `CSRF_TRUSTED_ORIGINS` incluye:

- `https://cpaldaca.com`
- `https://www.cpaldaca.com`
- `https://api.cpaldaca.com`
- `https://codigos.cpaldaca.com`
- `https://www.codigos.cpaldaca.com`

En DEBUG local (sin dominio de cookie): puertos `5173`, `8000`–`8003`.

---

## 3. Tablas compartidas

### 3.1 Tablas de identidad Suite (lectura/escritura vía ORM de `core`)

| Tabla | Modelo local | Compartida con |
|---|---|---|
| `core_usuario` | `UsuarioPaldaca` | Todos los módulos que usan el mismo `AUTH_USER_MODEL` |
| `core_disciplina` | `Disciplina` | Suite |
| `core_perfil` | `Perfil` | Suite |
| `core_modulo` | `Modulo` | Suite |
| `core_usuario_modulo` | `UsuarioModulo` | Suite (autorización por programa) |
| `django_session` | (Django) | SSO compartido (implícito por cookie de sesión) |

### 3.2 Tablas propias del dominio Códigos

| Tabla | Modelo | Consumidores conocidos en este repo |
|---|---|---|
| `codigos_empresa` | `Empresa` | Solo Códigos |
| `codigos_codigo_generado` | `CodigoGenerado` | Solo Códigos |
| `codigos_solicitud_anulacion` | `SolicitudAnulacion` | Solo Códigos |
| `codigos_contador_codigo` | `ContadorCodigo` | Definida; **no usada** en vistas actuales |

Migración histórica documentada en `GUIA.md`: datos legacy desde `codigos_db.documentos_*` hacia `paldaca_db.codigos_*`.

### 3.3 Tablas de otros módulos presentes en este repo (espejo de esquema)

| Tabla | Modelo en `core` | Origen funcional | Uso por Códigos |
|---|---|---|---|
| `calidad_role` | `Role` | Módulo Calidad | **Ninguno** en vistas/permisos de Códigos |
| `calidad_user_role` | `UserRole` | Módulo Calidad | Ninguno |
| `calidad_google_drive_token` | `GoogleDriveToken` | Módulo Calidad | Ninguno |

Campos de Hoja de Tiempo en `core_usuario` (migración `0013`):

- `date_last_hour_entry`
- `auto_timesheet_generation_suspended`
- `auto_timesheet_generation_suspended_at`

**Uso por Códigos:** ninguno en lógica de negocio. Existen para mantener el esquema alineado con HDT en la BD única.

---

## 4. Modelos que dependen de otros sistemas

| Dependencia | Detalle |
|---|---|
| `CodigoGenerado.usuario` | FK a `core.UsuarioPaldaca` (usuarios creados/gestionados típicamente desde Portal/Suite) |
| `CodigoGenerado.usuario_anulacion` | Idem |
| `SolicitudAnulacion.solicitante` | Idem |
| Acceso al módulo | Filas en `core_usuario_modulo` con `modulo.codigo="codigos"` (o superuser) |
| Aprobadores | Rol Suite `administrador` + acceso módulo, o permiso Django `documentos.puede_anular_codigo` |

Migración `documentos.0007_migrate_auth_user_to_core`: evidencia de transición desde `auth_user` legacy hacia `core_usuario`.

---

## 5. APIs que consume

### 5.1 Navegación compartida del Portal (runtime frontend)

`core/context_processors.py` + `core/templates/includes/paldaca_nav.html` inyectan:

| Recurso | DEBUG | Producción |
|---|---|---|
| CSS nav | `http://127.0.0.1:8000/static/paldaca-nav.css` | `https://cpaldaca.com/static/paldaca-nav.css` |
| JS nav | `http://127.0.0.1:8000/static/paldaca-nav.js` | `https://cpaldaca.com/static/paldaca-nav.js` |
| API base nav | `http://127.0.0.1:8000/api` | `https://api.cpaldaca.com/api` |
| Portal URL | `http://localhost:5173` | `https://cpaldaca.com` |
| `currentApp` | `"codigos"` | `"codigos"` |

El JS del Portal (`paldaca-nav.js`) se espera que consulte la API del Portal para armar el menú; Códigos **no implementa** esos endpoints.

### 5.2 SSO logout

Logout local redirige a `PALDACA_SSO_LOGOUT_URL` (API del backend Portal: `/api/auth/sso/logout/` por defecto).

### 5.3 Bus de notificaciones del Portal

`documentos/notificaciones_portal.py` emite eventos a la campana del Portal con una
llamada server-to-server **firmada** (HMAC-SHA256 con clave derivada de
`DJANGO_SECRET_KEY`; misma función que `backend/notificaciones/firma.py` del Portal). No
usa la sesión del operador: por eso sirve aunque quien solicita no sea administrador.
Nunca lanza; se emite con `transaction.on_commit`.

| Evento | Dónde | Destinatarios |
|--------|-------|---------------|
| `codigos.solicitud_anulacion` | `solicitar_anulacion` → `documentos/avisos.py` | Resuelve el Portal: admins del módulo + superadmins. Códigos suma en `payload.usuario_ids` a los titulares del permiso `documentos.puede_anular_codigo` (directo o por grupo) con acceso a `codigos`, que el Portal no ve |

Juntos cubren la misma regla que `es_aprobador_codigos()`. Deep link a
`/codigos/solicitudes_anulacion/` dentro del shell.

Variables: `PALDACA_PORTAL_API_URL` (default `http://127.0.0.1:8000/api` con `DEBUG`,
`https://api.cpaldaca.com/api` en producción) y `PALDACA_NOTIFICACIONES_ACTIVAS` (`false`
la apaga; `codigos/settings_test.py` la apaga). Contrato completo en
`Portal-Paldaca/docs/guia-integracion-programas-satelite.md`.

Esto es la API del bus del Portal, no una API entre satélites: la regla "no inventar APIs
REST entre módulos" sigue en pie.

### 5.4 APIs REST propias

**No hay** un API REST documentada (DRF u similar) en este repositorio.

Endpoints JSON internos (misma app, no pensados como contrato inter-módulo):

| Método / ruta | Propósito |
|---|---|
| `POST /anular_codigo/<id>/` | Anulación directa |
| `POST /solicitar_anulacion/<id>/` | Crear solicitud |

---

## 6. APIs / superficies que expone

| Superficie | Tipo | Audiencia |
|---|---|---|
| URLs HTML de `documentos` y `core` | Server-rendered | Usuarios humanos con SSO |
| `/admin/` | Django Admin | Staff |
| Endpoints JSON de anulación | Fetch desde templates | UI propia |
| Assets estáticos | `collectstatic` → `codigos.cpaldaca.com/static` | Browser |

**No se evidencia** exposición de códigos hacia Activos, Calidad, HDT u otros backends.

---

## 7. Dependencias externas

### 7.1 Paquetes Python (`requirements.txt`)

| Paquete | Rol |
|---|---|
| Django==5.2.4 | Framework |
| mysqlclient / PyMySQL | Driver MySQL |
| python-dotenv | Carga `key.env` / `correo.env` |
| django-widget-tweaks | Formularios en templates |
| cryptography / cffi | Dependencias transitivas listadas |
| PyYAML | Usado por `scripts/cpanel_deploy_check.py` |

### 7.2 Infraestructura / servicios

| Servicio | Uso |
|---|---|
| MySQL compartido | Persistencia Suite |
| SMTP `codigos.cpaldaca.com:465` SSL | Notificación de nuevo código (`admin@codigos.cpaldaca.com`) |
| CDN Bootstrap / jQuery | UI |
| Phusion Passenger | Reinicio vía `touch passenger_wsgi.py` en CI |
| GitHub Actions + SSH | Deploy a Namecheap |
| cPanel Git Deployment | Ruta alternativa (`.cpanel.yml`) |

### 7.3 Variables de entorno esperadas

De `key.env.example` y `settings.py`:

- `DJANGO_SECRET_KEY` (**obligatoria**)
- `SESSION_COOKIE_DOMAIN`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`
- **Ciclo de vida no configurado:** `SESSION_COOKIE_AGE`, `SESSION_EXPIRE_AT_BROWSER_CLOSE`, `SESSION_SAVE_EVERY_REQUEST` **ausentes** → defaults Django (2 semanas / no expira al cerrar). **Diverge del Portal (8 h / expire at close / sliding).**
- `PALDACA_SSO_LOGIN_URL`, `PALDACA_SSO_LOGOUT_URL`
- `PALDACA_STRICT_SESSION_CONSISTENCY`
- `EMAIL_HOST_PASSWORD` (vía `correo.env`)
- `MYSQL_*` aparecen en el ejemplo, **pero `codigos/db.py` activo no las lee** (inconsistencia).

**Escritura en `core_usuario`:** no hay vistas CRUD de usuarios; solo admin Django y migración legacy `documentos/migrations/0007_migrate_auth_user_to_core.py`.

**Permiso `documentos.puede_anular_codigo`:** definido en `Meta.permissions` del modelo / migración `0004`; **no hay código que lo asigne** a usuarios o grupos — solo se consulta (`has_perm` / template). En la práctica el flujo de aprobación también usa `es_administrador_en_modulo("codigos")` vía `es_aprobador_codigos`.

**Locale:** `LANGUAGE_CODE = es-ve`, `TIME_ZONE = America/Caracas`.

**Nav DEBUG:** assets en `http://127.0.0.1:8000/static/paldaca-nav.*` (no `localhost`) — riesgo de cookie SSO si se mezcla host.

---

## 8. Integración prevista (evidencia en código, no flujo activo)

| Señal | Interpretación |
|---|---|
| Seed de módulos `ventas`, `inventario`, `rrhh`, `proyectos` | Catálogo Suite anticipa más programas; sin integración funcional en Códigos |
| Modelos `calidad_*` en `core` | Alineación de migraciones con Calidad en BD única; integración de negocio **no implementada** aquí |
| Campos timesheet en `UsuarioPaldaca` | Alineación con Hoja de Tiempo; sin uso en Códigos |
| Comentario settings: copiar `key.env` desde Portal-Paldaca | SSO/secretos unificados previstos como práctica operativa |
| `paldaca_nav_*` + `currentApp: "codigos"` | Portal Shell / navegación unificada ya parcialmente adoptada |
| `GUIA.md` migración `codigos_db` → `paldaca_db` | Unificación de BD ya ejecutada/documentada como proceso histórico |

**No hay evidencia** en este repo de llamadas HTTP hacia Activos, Calidad, HDT o Códigos-desde-otros.

---

## 9. Elementos que pueden romper compatibilidad con otros repositorios

1. **Migraciones de `core` en Códigos** que alteren `core_usuario`, `core_modulo` o creen/modifiquen `calidad_*` sin sincronizar el mismo orden/estado de migraciones en los demás repos.
2. **Cambio de `SECRET_KEY`** distinto al del Portal → sesiones inválidas / cookies no verificables entre apps.
3. **Cambio de `SESSION_COOKIE_NAME` / `SESSION_COOKIE_DOMAIN` / SameSite / Secure** → rompe SSO cross-subdomain.
4. **Renombrar o eliminar tablas `codigos_*`** → solo afecta dominio Códigos, pero `GUIA.md` y scripts externos pueden asumir esos nombres.
5. **Cambiar `MODULO_CODIGO`** (`"codigos"`) → rompe autorización (`tiene_acceso_modulo`) y filas existentes en `core_modulo` / `core_usuario_modulo`.
6. **Modificar `get_auth_revision`** de forma distinta a otros repos con el mismo middleware → cierres de sesión inconsistentes o permisos obsoletos en sesión.
7. **Credenciales/BD distintas** entre repos (hoy `db.py` hardcodea producción) → divergencia del supuesto “una sola BD”.
8. **`DEBUG=True` / `ALLOWED_HOSTS` mal formados** → comportamiento distinto de cookies/CSRF respecto al resto de la Suite.
9. **Publicar o alterar modelos Calidad/HDT desde este repo** sin coordinación → riesgo de drift de esquema.

---

## 10. Mapa rápido de acoplamiento

```
Portal-Paldaca
  ├── emite cookie SSO (paldaca_sessionid)
  ├── expone /api/auth/sso/logout/
  ├── expone /api (nav) + static paldaca-nav.*
  └── gestiona usuarios/módulos en core_*   ──►  Códigos consume

Códigos
  ├── lee/escribe core_* (identidad, acceso módulo)
  ├── lee/escribe codigos_* (dominio propio)
  ├── declara calidad_* y campos HDT (esquema; sin lógica)
  └── SMTP propio (notificaciones)

Activos / Calidad / HDT / ...
  └── comparten core_* + sesión  (sin API directa con Códigos en este código)
```
