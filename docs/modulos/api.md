# Módulo `api` (`backend/api/`)

> Responsabilidad: exponer el servicio declarado D-16 `codigos/generar-codigos` (modo automático para Control de Documentos y otras apps autorizadas).

## 1. Diseño sin modelos propios (D-19)

`api` **no define modelos** ni importa modelos de `catalogos` o `registro`: toda la lógica se delega en `catalogos.services` y `registro.services`, autenticada mediante `integracion.permissions.ServicioAPIMixin`.

## 2. Endpoints (`/api/servicios/generar-codigos/`)

Todos requieren cabeceras HMAC-SHA256 válidas del servicio `generar-codigos` para la organización indicada en `X-Cereipo-Organizacion`:

| Método y ruta | Acción | Código HTTP |
|---|---|---|
| `GET catalogos/` | Devuelve `sigla` fija de la organización y `segmentos` activos agrupados | `200` |
| `POST reservar/` | Reserva lote en estado `reservado` con soporte de `clave_idempotencia` | `201` (si hay nuevos) / `200` (todo repetido) |
| `POST confirmar/` | Confirma códigos reservados por lista de `codigos` | `200` |
| `POST generar/` | Genera lote directamente en estado `confirmado` (idempotente) | `201` (si hay nuevos) / `200` (todo repetido) |
| `POST anular/` | Anula lista de códigos con motivo obligatorio (idempotente) | `200` |
| `POST consultar/` | Consulta estado actual por `codigos` y/o `referencias_externas` | `200` |

## 3. Reglas clave de la API

- **Sin selección de empresa/organización en el payload**: la organización viene autenticada en `X-Cereipo-Organizacion` y su `{SIGLA_ORG}` proviene exclusivamente de `ConfiguracionOrganizacion`.
- **Trazabilidad**: `api/services/bitacora.py` reporta cada invocación al Shell de forma no bloqueante (`reportar_bitacora_servicio`).
- **Errores tipados**: payloads inválidos (`400 datos-invalidos`), organización sin sigla configurada (`409 sigla-no-configurada`), segmento inexistente/inactivo (`400 segmento-invalido`), conflicto de idempotencia (`409 idempotencia-conflicto`).
