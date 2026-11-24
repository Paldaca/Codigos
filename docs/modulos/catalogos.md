# Módulo `catalogos` (`backend/catalogos/`)

> Responsabilidad: configuración única de sigla por organización y catálogos editables de segmentos (tarea 5.2 + publicación maestra 5.5).

## 1. Modelos (`catalogos/models.py`)

- **`ConfiguracionOrganizacion` (`ModeloDeOrganizacion`)**:
  - `sigla` (`2..10` caracteres alfanuméricos en mayúsculas): prefijo fijo `{SIGLA_ORG}` de todos los códigos de la organización.
  - `correo_notificacion`, `notificar_por_correo`: configuración SMTP por organización.
  - `bloqueada_por_codigos`: se vuelve `True` al emitirse o reservarse el primer código; impide editar `sigla` posteriormente (`409 sigla-bloqueada`).
- **`CatalogoSegmento` (`ModeloDeOrganizacion`)**:
  - `tipo`: `proyecto` (`NN`), `subproyecto` (`S`), `departamento` (`DEPT`), `disciplina` (`DISC`), `tipo_documento` (`TIPO`).
  - `codigo` (`1..10` caracteres en mayúsculas), `nombre`, `codigo_shell` (opcional, D-39), `orden`, `activo`.
  - Restricción única por `(organizacion_id, tipo, codigo)`.

## 2. Servicios (`catalogos/services/`)

- **`organizacion.py`**: obtener/actualizar `ConfiguracionOrganizacion`, `obtener_sigla_obligatoria`, `obtener_y_bloquear_sigla` (con `select_for_update()`), `marcar_sigla_bloqueada` y `configurar_migracion_organizacion`.
- **`segmentos.py`**: CRUD de segmentos, listado agrupado (`catalogo_agrupado`), `sembrar_catalogos_estandar()` (siembra los 5 tipos desde `semillas.py`), y resolución tolerante entre código propio de Códigos y `codigo_shell` (`validar_y_resolver_segmentos`).
- **`semillas.py`**: constantes `PROYECTOS_ESTANDAR`, `SUBPROYECTOS_ESTANDAR`, `DEPARTAMENTOS_ESTANDAR`, `DISCIPLINAS_ESTANDAR` y `TIPOS_DOCUMENTO_ESTANDAR`.
- **`publicacion.py`**: `construir_snapshot_catalogos()` lee la configuración/segmentos dentro de la transacción/RLS y `publicar_snapshot_catalogos()` los publica en `on_commit` bajo el maestro `codigos.catalogos` (también expone `publicar_catalogos_activos()` para invocación directa).

## 3. Endpoints REST (`backend/catalogos/urls.py`)

- `GET/PUT /api/catalogos/organizacion/`
- `GET /api/catalogos/organizacion/historial/`
- `GET/POST /api/catalogos/segmentos/`
- `PATCH /api/catalogos/segmentos/<int:segmento_id>/`
- `GET /api/catalogos/segmentos/historial/`
- `POST /api/catalogos/segmentos/lote/`
- `POST /api/catalogos/segmentos/revertir/<int:historial_id>/`
- `POST /api/catalogos/sembrar-estandar/`
- `POST /api/catalogos/restablecer-plantilla/`
- `GET /api/catalogos/instantaneas/`
- `POST /api/catalogos/instantaneas/<int:instantanea_id>/restaurar/`
