# BUSINESS_RULES.md — Reglas de negocio de Códigos (Cereipo)

> Cada regla está respaldada por su implementación actual en `backend/` y `frontend/`.

---

## 1. Acceso, identidad y aislamiento

### BR-01 — Autenticación vía Cereipo Shell y permisos granulares

- **Regla:** Códigos no mantiene tabla de usuarios ni login propio; toda petición de usuario pasa por `cereipo_sso.middleware.IdentidadCereipoMiddleware` y requiere el permiso de `codigos:*` correspondiente del manifiesto (`integracion/manifiesto.py`).
- **Permisos declarados:** `codigos:inicio:ver`, `codigos:registro:ver`, `codigos:codigos:generar`, `codigos:codigos:anular`, `codigos:catalogos:administrar`, `codigos:administracion:gestionar`.
- **Modo servicio (API entre apps):** `api.views.ServicioBaseView` hereda `integracion.permissions.ServicioAPIMixin` (`servicio_codigo = "generar-codigos"`), que valida HMAC-SHA256 emitido por la app consumidora autorizada y validado contra el Shell.

### BR-02 — Aislamiento multi-organización estricto con RLS

- **Regla:** Todos los modelos de dominio heredan `cereipo_sso.aislamiento.ModeloDeOrganizacion` con políticas PostgreSQL Row-Level Security (`ActivarRLS` en las migraciones `0001_initial`).
- **Regla de sigla fija por organización:** ni la UI manual ni la API automática aceptan `empresa` o `sigla` en el payload de generación; siempre se lee `ConfiguracionOrganizacion` de la organización activa (`request.cereipo.organizacion` en manual o `X-Cereipo-Organizacion` en servicio).

---

## 2. Catálogos de segmentos

### BR-03 — Sigla organizacional única y bloqueable

- **Regla:** Cada organización configura su `sigla` (`2..10` caracteres alfanuméricos en mayúsculas, `core/validators.py -> validar_sigla_organizacion`).
- **Bloqueo tras uso:** al asignar el primer código (manual o API), `catalogos.services.organizacion.marcar_sigla_bloqueada()` fija `bloqueada_por_codigos = True` y prohíbe modificar la sigla posteriormente (`409 Conflicto`).

### BR-04 — Catálogos configurables en datos y siembra estándar

- **Regla:** Los segmentos `proyecto` (`NN`), `subproyecto` (`S`), `departamento` (`DEPT`), `disciplina` (`DISC`) y `tipo_documento` (`TIPO`) se gestionan en `CatalogoSegmento` por organización.
- **Equivalencia opcional con Shell (D-39):** cada elemento puede registrar `codigo_shell` para mapear códigos largos del Shell (ej. `CIV` -> `C`) cuando el caller de API envía códigos del Shell o propios.
- **Siembra estándar:** `catalogos.services.semillas.sembrar_catalogos_estandar` carga los departamentos, disciplinas y tipos de documento estándar heredados de PALDACA (solo si no existen previamente, idempotente).
- **Publicación como maestro (D-17):** al modificar catálogos (o ejecutar `manage.py sincronizar_maestros`), `catalogos.services.publicacion.sincronizar_maestro_catalogos()` publica el catálogo completo de la organización bajo el maestro `codigos.catalogos` del Shell sin bloquear si el Shell está temporalmente inaccesible.

---

## 3. Generación, reserva y unicidad de códigos

### BR-05 — Estructura única de 8 segmentos

- **Regla:** Toda la suite Cereipo comparte la metodología estándar de 8 segmentos:

  `{SIGLA_ORG}-{AA}-{NN}-{S}-{DEPT}-{DISC}-{TIPO}-{CCC}`

  donde `AA` son los últimos 2 dígitos del año (`2015–2100`), y `CCC` tiene al menos 3 dígitos con ceros a la izquierda (`f"{consecutivo:03d}"`, `core/utils.py -> formatear_codigo`).

### BR-06 — Consecutivo atómico por combinación de segmentos

- **Regla:** Cada combinación `(organizacion_id, anio, numero_proyecto, subproyecto, departamento, disciplina, tipo_documento)` posee su fila en `ContadorSecuencia`.
- **Implementación:** `registro.services.generador.reservar_o_generar_lote()` ordena las combinaciones de un lote de forma determinística antes de adquirir `select_for_update()` sobre `ContadorSecuencia`, evitando colisiones y deadlocks concurrentes.

### BR-07 — Flujo en dos pasos para usuario manual (previsualización y confirmación)

- **Regla:** El programa manual ofrece `POST /api/registro/previsualizar/` (valida segmentos y muestra el siguiente consecutivo estimado sin consumir secuencia) y `POST /api/registro/generar/` (requiere `motivo` no vacío y persiste en estado `confirmado`, bloqueando la sigla si aún no lo estaba).

### BR-08 — Idempotencia y ciclo reserva -> confirmación (API automática)

- **Regla:** En llamadas de servicio (`reservar`, `generar`) cada ítem puede incluir `clave_idempotencia`. Si la combinación `(organizacion_id, origen, clave_idempotencia)` ya existe con los mismos segmentos, se devuelve el registro previo (`repetido: true`, HTTP `200` si todo el lote es repetido); si intenta reutilizar la misma clave con segmentos distintos, responde `409 Conflict` (`idempotencia-conflicto`).
- **Reserva en lote vs generación directa:** `reservar` crea códigos en estado `reservado` (ya consumen consecutivo para evitar duplicados); `confirmar` pasa códigos `reservado` a `confirmado` (acepta motivo actualizado); `generar` los crea directamente en estado `confirmado`. Si ya estaban confirmados, `confirmar` responde idempotentemente sin error.

### BR-09 — Notificación por correo tolerante a fallos

- **Regla:** Cuando `ConfiguracionOrganizacion.notificar_por_correo` está activo y existe `correo_notificacion`, la confirmación manual o automática intenta enviar correo usando `registro/services/correos.py` y `registro/templates/registro/emails/nuevo_codigo.html`.
- **Tolerancia a fallos:** si el servidor SMTP falla, el código **permanece guardado** y se reporta advertencia en la respuesta sin revertir la transacción.

---

## 4. Consulta, anulación y auditoría

### BR-10 — Consulta e historial auditable

- **Regla:** `GET /api/registro/codigos/` filtra por texto (`q`), estado (`reservado`, `confirmado`, `anulado`), año, proyecto, subproyecto, departamento, disciplina, tipo, origen (`manual`/`api`) y rango de fechas. Por defecto excluye anulados salvo que se pida incluirlos (`incluir_anulados=1` o `estado=anulado`).
- **Historial:** Toda creación, confirmación, anulación o cambio de configuración registra auditoría vía `cereipo_sso.historial` y se muestra con `<HistorialRegistro />` en la SPA.

### BR-11 — Anulación directa y solicitudes de anulación

- **Regla:** Un código anulado cambia a `estado = "anulado"`, exige `motivo_anulacion` no vacío, conserva actor/fecha y **nunca libera ni reutiliza su consecutivo**.
- **Dos vías para usuarios:**
  - Quien tiene `codigos:codigos:anular` puede anular directamente o aprobar/rechazar solicitudes pendientes en `/anulaciones/`.
  - Quien solo tiene `codigos:codigos:generar` puede crear una `SolicitudAnulacion` (`POST /api/registro/codigos/<id>/solicitar-anulacion/`), lo cual emite el aviso `codigos.solicitud_anulacion` al Shell.
- **Vía automática (API):** `POST /api/servicios/generar-codigos/anular/` anula por lote con idempotencia si un código ya estaba anulado. Toda anulación aprobada o ejecutada emite `codigos.codigo_anulado`.

---

## 5. Migración histórica desde PALDACA (tarea 5.7)

### BR-12 — Preservación de consecutivos históricos por empresa

- **Regla:** `manage.py migrar_desde_mysql` mapea cada `codigos_empresa` a una `organizacion_id` de Cereipo (JSON de mapeo), migra sus códigos, motivos y solicitudes en estado `confirmado` o `anulado` con sus consecutivos exactos, marca `bloqueada_por_codigos = True` si tuvo registros e inicializa `ContadorSecuencia.ultimo_consecutivo = MAX(consecutivo)` por combinación, verificando conteos y ausencia de duplicados.
