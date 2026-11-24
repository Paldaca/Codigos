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
  - Estados `pendiente`, `aprobada`, `rechazada` con flujo completo para usuarios sin permiso directo de anulación.

## 2. Servicios (`registro/services/`)

- **`generador.py`**: `reservar_o_generar_lote()`, `confirmar_lote()`, previsualización de consecutivo, orden determinístico de locks anti-deadlock y cálculo de idempotencia.
- **`consultas.py`**: resúmenes estadísticos, listados con filtros (`q`, `estado`, `anio`, segmentos, `origen`, fechas, `incluir_anulados`) e historial auditable.
- **`anulaciones.py`**: anulación directa, solicitud de anulación, aprobación/rechazo de solicitudes y emisión de avisos al Shell (`codigos.solicitud_anulacion`, `codigos.codigo_anulado`).
- **`correos.py`**: notificación SMTP al confirmar código usando `templates/registro/emails/nuevo_codigo.html` (hereda `core/base_email.html`), sin revertir la transacción ante errores SMTP.

## 3. Comando de migración PALDACA (`management/commands/migrar_desde_mysql.py`)

Migra empresas, códigos (`codigos_codigo_generado`) y solicitudes (`codigos_solicitud_anulacion`) desde MySQL hacia PostgreSQL por organización, verificando conteos, cero duplicados e inicializando `ContadorSecuencia` en `MAX(consecutivo)`.
