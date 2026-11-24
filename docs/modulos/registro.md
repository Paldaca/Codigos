# Módulo `registro` (`backend/registro/`)

> Responsabilidad: motor transaccional de consecutivo y ciclo de vida completo de códigos documentales y de planos (tareas 5.3, 5.6, 5.7).

## 1. Modelos (`registro/models.py`)

- **`ContadorSecuencia` (`ModeloDeOrganizacion`)**:
  - Clave única `(organizacion_id, anio, numero_proyecto, subproyecto, departamento, disciplina, tipo_documento)`.
  - Almacena `ultimo_consecutivo` bajo bloqueo `select_for_update()`.
- **`CodigoRegistro` (`ModeloDeOrganizacion`)**:
  - UUID PK, 8 segmentos (`sigla`, `anio`, `numero_proyecto`, `subproyecto`, `departamento`, `disciplina`, `tipo_documento`, `consecutivo`), `codigo` (`{SIGLA}-{AA}-{NN}-{S}-{DEPT}-{DISC}-{TIPO}-{CCC}`).
  - Estados: `reservado`, `confirmado`, `anulado`.
  - Orígenes: `manual`, `api` + `app_origen`, `clave_idempotencia`, `referencia_externa`, `proyecto_shell_codigo`, `disciplina_shell_codigo`.
  - Auditoría de creación/anulación y restricción de unicidad por `(organizacion_id, codigo)` e idempotencia `(organizacion_id, origen, clave_idempotencia)`.
- **`SolicitudAnulacion` (`ModeloDeOrganizacion`)**:
  - Estados `pendiente`, `aprobada`, `rechazada` con flujo completo para usuarios sin permiso directo de anulación ni autoría del código.

## 2. Servicios (`registro/services/`)

- **`generador.py`**: `previsualizar_lote()`, `reservar_o_generar_lote()`, `confirmar_lote()`, orden determinístico de locks anti-deadlock y serialización de idempotencia en PostgreSQL vía `pg_advisory_xact_lock`.
- **`consultas.py`**: `resumen_registro()`, `buscar_codigos()` (filtros por `codigo`, `estado`, `origen`, `numero_proyecto`, `disciplina`, `tipo_documento`, `creado_por`, `fecha_inicio`, `fecha_fin`, `incluir_anulados=False` por defecto; orden `-fecha_anulacion` cuando `estado=anulado`), `listar_solicitudes()`.
- **`anulaciones.py`**: anulación directa (aprobadores o creador del código), solicitud de anulación, aprobación/rechazo de solicitudes y emisión de avisos al Shell (`codigos.solicitud_anulacion`, `codigos.codigo_anulado`).
- **`correos.py`**: notificación SMTP ejecutada en `transaction.on_commit` al confirmar código manual usando `templates/registro/emails/nuevo_codigo.html` (hereda `core/base_email.html`), tolerante a fallos SMTP.

## 3. Comando de migración PALDACA (`management/commands/migrar_desde_mysql.py`)

Migra de forma idempotente empresas, códigos (`codigos_codigo_generado`) y solicitudes (`codigos_solicitud_anulacion`) desde MySQL (o `--desde-json`) hacia PostgreSQL por organización, verificando conteos, cero duplicados e inicializando `ContadorSecuencia` en `MAX(consecutivo)`.
