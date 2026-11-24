# Módulo `api` (`backend/api/`)

> Responsabilidad: exponer el servicio declarado D-16 `codigos/generar-codigos` (modo automático para Control de Documentos y otras apps autorizadas).

## 1. Diseño sin modelos propios (D-19)

`api` **no define modelos** ni importa modelos ni vistas de `catalogos`, `registro` o `integracion`: toda la lógica se delega en `catalogos.services` y `registro.services`, autenticada mediante `integracion.permissions.ServicioAPIMixin`.

## 2. Endpoints (`/api/servicios/generar-codigos/`)

Todos requieren cabeceras HMAC-SHA256 válidas del servicio `generar-codigos` para la organización indicada en `X-Cereipo-Organizacion`:

| Método y ruta | Acción | Código HTTP |
|---|---|---|
| `GET catalogos/` | Devuelve `sigla` fija de la organización y `segmentos` activos agrupados | `200` |
| `POST reservar/` | Reserva lote en estado `reservado` con soporte de `clave_idempotencia` | `201` (si hay nuevos) / `200` (todo repetido) |
| `POST confirmar/` | Confirma códigos reservados por `codigos` o `claves_idempotencia` | `200` |
| `POST generar/` | Genera lote directamente en estado `confirmado` (idempotente) | `201` (si hay nuevos) / `200` (todo repetido) |
| `POST anular/` | Anula códigos por `codigos` o `referencias_externas` con motivo obligatorio (idempotente) | `200` |
| `POST consultar/` | Consulta estado actual por `codigos` y/o `referencias_externas` | `200` |

## 3. Reglas clave de la API

- **Sin selección de empresa/organización en el payload**: los ítems rechazan `empresa`, `sigla`, `organizacion` y `organizacion_id` (`400 datos-invalidos`); la organización viene autenticada en `X-Cereipo-Organizacion` y su `{SIGLA_ORG}` proviene exclusivamente de `ConfiguracionOrganizacion`.
- **Trazabilidad**: `api/services/bitacora.py` (`registrar_llamada()`) reporta cada invocación al Shell en `transaction.on_commit` mediante `cereipo_sso.servicios.reportar_uso_servicio()` de forma no bloqueante.
- **Errores tipados**: payloads inválidos (`400 datos-invalidos`), organización sin sigla configurada (`409 sigla-no-configurada`), conflicto de idempotencia (`409 conflicto-idempotencia`).
