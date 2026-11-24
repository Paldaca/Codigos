# BUSINESS_RULES.md — Reglas de negocio de Códigos (Cereipo)

> Cada regla está respaldada por su implementación actual en `backend/` y `frontend/`. Incluye los ajustes documentados respecto a la versión legada de PALDACA.

---

## 1. Acceso, identidad y aislamiento

### BR-01 — Autenticación vía Cereipo Shell y permisos granulares

- **Regla:** Códigos no mantiene tabla de usuarios ni login propio; toda petición de usuario pasa por `cereipo_sso.middleware.IdentidadMiddleware` y requiere el permiso de `codigos:*` correspondiente del manifiesto (`integracion/manifiesto.py`).
- **Permisos declarados:** `codigos:inicio:ver`, `codigos:registro:ver`, `codigos:codigos:generar`, `codigos:codigos:anular`, `codigos:catalogos:administrar`, `codigos:administracion:gestionar`.
- **Equivalencia desde PALDACA:** el antiguo permiso `documentos.puede_anular_codigo` fue sustituido por `codigos:codigos:anular`; las notificaciones al Portal de Paldaca fueron sustituidas por avisos al Shell (`integracion/services/avisos.py`).
- **Modo servicio (API entre apps):** `api.views.ServicioBaseView` hereda `cereipo_sso.drf.ServicioAPIMixin` (`servicio_codigo = "generar-codigos"`), que valida HMAC-SHA256 emitido por la app consumidora autorizada y validado contra el Shell.

### BR-02 — Aislamiento multi-organización estricto con RLS

- **Regla:** Todos los modelos de dominio heredan `cereipo_sso.aislamiento.ModeloDeOrganizacion` con políticas PostgreSQL Row-Level Security (`ActivarRLS` en las migraciones `0001_initial`).
- **Regla de sigla fija por organización:** ni la UI manual ni la API automática aceptan `empresa`, `sigla`, `organizacion` ni `organizacion_id` en el payload de generación; siempre se lee `ConfiguracionOrganizacion` de la organización activa (`request.cereipo.organizacion` en manual o `X-Cereipo-Organizacion` en servicio).

---

## 2. Catálogos de segmentos

### BR-03 — Sigla organizacional única y bloqueable

- **Regla:** Cada organización configura su `sigla` (`2..10` caracteres alfanuméricos en mayúsculas, `core/validators.py -> validar_sigla_organizacion`).
- **Bloqueo tras uso:** al asignar el primer código (manual o API), `catalogos.services.organizacion.marcar_sigla_bloqueada()` fija `bloqueada_por_codigos = True` y prohíbe modificar la sigla posteriormente (`409 sigla-bloqueada`).

### BR-04 — Catálogos configurables en datos y siembra estándar

- **Regla:** Los segmentos `proyecto` (`NN`), `subproyecto` (`S`), `departamento` (`DEPT`), `disciplina` (`DISC`) y `tipo_documento` (`TIPO`) se gestionan en `CatalogoSegmento` por organización.
- **Equivalencia opcional con Shell (D-39):** cada elemento puede registrar `codigo_shell` para mapear códigos largos del Shell (ej. `CIV` -> `C`) cuando el caller de API envía códigos del Shell o propios.
- **Siembra estándar:** `catalogos.services.segmentos.sembrar_catalogos_estandar()` carga los 5 tipos estándar (`PROYECTOS_ESTANDAR`, `SUBPROYECTOS_ESTANDAR`, `DEPARTAMENTOS_ESTANDAR`, `DISCIPLINAS_ESTANDAR`, `TIPOS_DOCUMENTO_ESTANDAR` desde `catalogos/services/semillas.py`) de forma idempotente.
- **Publicación como maestro (D-17):** al modificar catálogos, `catalogos.services.publicacion.construir_snapshot_catalogos()` arma el snapshot dentro de la transacción/RLS y `publicar_snapshot_catalogos()` lo publica en `on_commit` bajo el maestro `codigos.catalogos` del Shell.

---

## 3. Generación, reserva y unicidad de códigos

### BR-05 — Estructura única de 8 segmentos

- **Regla:** Toda la suite Cereipo comparte la metodología estándar de 8 segmentos:

  `{SIGLA_ORG}-{AA}-{NN}-{S}-{DEPT}-{DISC}-{TIPO}-{CCC}`

  donde `AA` son los últimos 2 dígitos del año (`2015–2100` en `core/validators.py`; ampliado desde `2020..año+1` de PALDACA para soportar históricos), y `CCC` tiene al menos 3 dígitos con ceros a la izquierda (`f"{consecutivo:03d}"`, `core/utils.py -> formatear_codigo`).

### BR-06 — Consecutivo atómico por combinación de segmentos

- **Regla:** Cada combinación `(organizacion_id, anio, numero_proyecto, subproyecto, departamento, disciplina, tipo_documento)` posee su fila en `ContadorSecuencia`.
- **Implementación:** `registro.services.generador.reservar_o_generar_lote()` ordena las combinaciones de un lote de forma determinística antes de adquirir `select_for_update()` sobre `ContadorSecuencia`, evitando colisiones y deadlocks concurrentes.

### BR-07 — Flujo en dos pasos para usuario manual (previsualización y confirmación)

- **Regla:** El programa manual ofrece `POST /api/registro/previsualizar/` (valida segmentos y muestra el siguiente consecutivo estimado sin consumir secuencia) y `POST /api/registro/generar/` (requiere `motivo` no vacío y persiste en estado `confirmado`, bloqueando la sigla si aún no lo estaba).

### BR-08 — Idempotencia y ciclo reserva -> confirmación (API automática)

- **Regla:** En llamadas de servicio (`reservar`, `generar`) cada ítem puede incluir `clave_idempotencia`. Las peticiones concurrentes con la misma clave nueva se serializan vía `pg_advisory_xact_lock`. Si la combinación `(organizacion_id, origen, clave_idempotencia)` ya existe con los mismos segmentos, se devuelve el registro previo (`repetido: true`, HTTP `200` si todo el lote es repetido; o si estaba `reservado` y se llama a `generar`, se confirma); si intenta reutilizar la misma clave con segmentos distintos, responde `409 conflicto-idempotencia`.
- **Reserva en lote vs generación directa:** `reservar` crea códigos en estado `reservado` (ya consumen consecutivo para evitar duplicados); `confirmar` pasa códigos `reservado` a `confirmado` (por lista de `codigos` o `claves_idempotencia`, sin modificar el `motivo`); `generar` los crea directamente en estado `confirmado`.

### BR-09 — Notificación por correo tolerante a fallos

- **Regla:** Cuando `ConfiguracionOrganizacion.notificar_por_correo` está activo y existe `correo_notificacion`, la generación manual confirmada programa en `transaction.on_commit` el envío de correo usando `registro/services/correos.py` y `registro/templates/registro/emails/nuevo_codigo.html`.
- **Cambio respecto a PALDACA:** los logos específicos por empresa se unificaron en una plantilla limpia sin imágenes locales (`core/base_email.html`), `notificar_por_correo` inicia en `False` por defecto y el envío se ejecuta fuera de la transacción de BD para no retener bloqueos. Si el SMTP falla, el error se registra en log y no revierte los códigos guardados.

---

## 4. Consulta, anulación y auditoría

### BR-10 — Consulta, filtros y ordenamiento

- **Regla:** `GET /api/registro/codigos/` filtra por `codigo` (`icontains`), `estado`, `origen`, `numero_proyecto`, `disciplina`, `tipo_documento`, `creado_por`, `fecha_inicio`, `fecha_fin` e `incluir_anulados` (`0`/`1`).
- **Exclusión de anulados y paginación:** por defecto excluye los códigos anulados (`incluir_anulados=0`, igual que en PALDACA) salvo que se marque `incluir_anulados=1` o `estado=anulado`. Cuando `estado=anulado`, ordena por `-fecha_anulacion, -fecha_creacion, -consecutivo`. En reemplazo de los «15 recientes sin paginar» (`?todos=1`) de PALDACA, la consulta usa paginación de 25 registros por página (`tamano` máximo 100).
- **Historial:** Toda creación, confirmación, anulación o cambio de configuración registra auditoría vía `cereipo_sso.historial` y se muestra con `<HistorialRegistro />` en la SPA.

### BR-11 — Anulación directa y solicitudes de anulación

- **Regla:** Un código anulado cambia a `estado = "anulado"`, exige `motivo_anulacion` no vacío, conserva actor/fecha y **nunca libera ni reutiliza su consecutivo**.
- **Tres vías según rol y autoría:**
  - Quien tiene `codigos:codigos:anular` (aprobador) puede anular directamente cualquier código y aprobar o rechazar solicitudes pendientes en `/anulaciones/`.
  - El **creador** (`creado_por_persona_id`) con `codigos:codigos:generar` puede anular directamente sus propios códigos.
  - Quien tiene `codigos:codigos:generar` sobre un código ajeno puede crear una `SolicitudAnulacion` (`POST /api/registro/codigos/<id>/solicitar-anulacion/`), lo cual emite el aviso `codigos.solicitud_anulacion` al Shell.
- **Vía automática (API):** `POST /api/servicios/generar-codigos/anular/` anula por lote (por `codigos` o `referencias_externas`) con idempotencia si un código ya estaba anulado. Toda anulación aprobada o ejecutada emite `codigos.codigo_anulado`.

---

## 5. Migración histórica desde PALDACA (tarea 5.7)

### BR-12 — Preservación de consecutivos históricos por empresa

- **Regla:** `manage.py migrar_desde_mysql` (soporta `--mysql-url` o `--desde-json`, `--empresa-sigla` + `--organizacion-id` o `--mapa-empresas-org`, `--mapa-usuarios`, `--dry-run`) migra cada `codigos_empresa` a su `organizacion_id` de Cereipo de forma idempotente, preserva códigos, motivos y solicitudes en estado `confirmado` o `anulado` con sus consecutivos exactos, marca `bloqueada_por_codigos = True` si tuvo registros e inicializa `ContadorSecuencia.ultimo_consecutivo = MAX(consecutivo)` por combinación, verificando conteos y ausencia de duplicados.
