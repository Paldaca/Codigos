# Módulo `catalogos` (`backend/catalogos/`)

> Responsabilidad: configuración única de sigla por organización y catálogos editables de segmentos (tarea 5.2 + publicación maestra 5.5).

## 1. Modelos (`catalogos/models.py`)

- **`ConfiguracionOrganizacion` (`ModeloDeOrganizacion`)**:
  - `sigla` (`2..10` caracteres alfanuméricos en mayúsculas): prefijo fijo `{SIGLA_ORG}` de todos los códigos de la organización.
  - `correo_notificacion`, `notificar_por_correo`: configuración SMTP por organización.
  - `bloqueada_por_codigos`: se vuelve `True` al emitirse o reservarse el primer código; impide editar `sigla` posteriormente (`409`).
- **`CatalogoSegmento` (`ModeloDeOrganizacion`)**:
  - `tipo`: `proyecto` (`NN`), `subproyecto` (`S`), `departamento` (`DEPT`), `disciplina` (`DISC`), `tipo_documento` (`TIPO`).
  - `codigo` (`1..10` caracteres en mayúsculas), `nombre`, `codigo_shell` (opcional, D-39), `orden`, `activo`.
  - Restricción única por `(organizacion_id, tipo, codigo)`.

## 2. Servicios (`catalogos/services/`)

- **`organizacion.py`**: obtener/actualizar `ConfiguracionOrganizacion`, validar sigla obligatoria (`obtener_sigla_obligatoria`), marcar `bloqueada_por_codigos`.
- **`segmentos.py`**: CRUD de segmentos, listado agrupado (`catalogo_agrupado`), resolución tolerante entre código propio de Códigos y `codigo_shell` (`validar_y_resolver_segmentos`).
- **`semillas.py`**: `sembrar_catalogos_estandar()` carga departamentos, disciplinas y tipos de documento estándar heredados de PALDACA de forma idempotente.
- **`publicacion.py`**: publica el maestro `codigos.catalogos` en Cereipo Shell cada vez que cambian la configuración o los segmentos (no bloqueante si el Shell no está disponible).

## 3. Endpoints REST (`backend/catalogos/urls.py`)

- `GET/PUT /api/catalogos/organizacion/`
- `GET /api/catalogos/organizacion/historial/`
- `GET/POST /api/catalogos/segmentos/`
- `PATCH/DELETE /api/catalogos/segmentos/<int:segmento_id>/`
- `POST /api/catalogos/sembrar-estandar/`
