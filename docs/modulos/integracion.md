# Módulo `integracion` (`backend/integracion/`)

> Responsabilidad: acoplamiento técnico con **Cereipo Shell** y validación del aislamiento PostgreSQL RLS.

## 1. Qué contiene

- **`manifiesto.py`**: expone `GET /.well-known/cereipo-app.json` con el contrato v1 de la app `codigos` (`requiere_proyecto: False`), menú, permisos (`codigos:*`), roles sugeridos (`administrador`, `aprobador`, `generador`, `consulta`), servicio declarado `generar-codigos`, avisos (`codigos.solicitud_anulacion`, `codigos.codigo_anulado`), maestro propio `codigos.catalogos`, `publica` y `consume`.
- **`permissions.py`**: exporta `TieneIdentidad`, `ServicioAPIMixin`, `requiere_permiso` y `tiene_permiso` hacia las demás apps.
- **`models.py`**: `AmbitoPropio`, `AsignacionAmbito`, `MaestroShellCache` (`ModeloDeOrganizacion`) y `CursorMaestro`.
- **`services/`**:
  - `salud.py`: chequeo real de PostgreSQL y Redis (`/salud/`).
  - `avisos.py`: emisión no bloqueante de avisos al Shell (`emitir_aviso`).
  - `maestros.py`: lectura incremental de maestros del Shell (`refrescar_maestros_shell`) y publicación de `codigos.catalogos` (`publicar_catalogo_maestro`).
- **`views.py`**: `GET /salud/`, `GET /.well-known/cereipo-app.json`, `GET /api/yo/` (con `@ensure_csrf_cookie`), `GET /api/administracion/ambitos/` (requiere `es_admin_organizacion` o `codigos:administracion:gestionar`) y `GET /api/integracion/maestros-shell/`.
- **`management/commands/sincronizar_maestros.py`**: comando operativo para consumir incrementalmente los datos maestros del Shell hacia `MaestroShellCache` mediante `refrescar_maestros_shell()`.
- **`tests/`**:
  - `test_integracion.py`: pruebas de `/salud/`, manifiesto y cookie CSRF en `/api/yo/`.
  - `test_aislamiento_rls.py`: verifica aislamiento real en PostgreSQL sobre las 8 tablas `ModeloDeOrganizacion` (`con_organizacion` y rechazo de escritura cruzada).

## 2. Regla de dependencia (D-19)

`integracion` **no importa** `catalogos`, `registro` ni `api` (verificado por `.importlinter`).
