# Módulo `integracion` (`backend/integracion/`)

> Responsabilidad: acoplamiento técnico con **Cereipo Shell** y validación del aislamiento PostgreSQL RLS.

## 1. Qué contiene

- **`manifiesto.py`**: expone `GET /.well-known/cereipo-app.json` con el contrato v1 de la app `codigos` (`requiere_proyecto: False`), menú, permisos (`codigos:*`), roles sugeridos (`administrador`, `aprobador`, `generador`, `consulta`), servicio declarado `generar-codigos`, avisos (`codigos.solicitud_anulacion`, `codigos.codigo_anulado`) y maestro propio `codigos.catalogos`.
- **`permissions.py`**: alias y configuración de `ServicioAPIMixin` / permisos de usuario (`PermisoModulo`) hacia el resto de las apps.
- **`models.py`**: `AmbitoPropio` (`ModeloDeOrganizacion`) para administración de ámbitos internos de la app (`GET/POST /api/administracion/ambitos/`).
- **`services/`**:
  - `salud.py`: chequeo real de PostgreSQL y Redis (`/salud/`).
  - `avisos.py`: emisión no bloqueante de avisos al Shell.
  - `maestros.py`: cliente de lectura de maestros del Shell (`proyectos`, `disciplinas`).
- **`management/commands/sincronizar_maestros.py`**: comando operativo para consumir incrementalmente los datos maestros del Shell hacia `MaestroShellCache` mediante `refrescar_maestros_shell()`.
- **`tests/`**:
  - `test_integracion.py`: pruebas de `/salud/`, manifiesto y vistas de integración.
  - `test_aislamiento_rls.py`: verifica aislamiento real en PostgreSQL mediante `con_organizacion(...)` y rechazo de escritura cruzada.

## 2. Regla de dependencia (D-19)

`integracion` **no importa** `catalogos`, `registro` ni `api` (verificado por `.importlinter`).
