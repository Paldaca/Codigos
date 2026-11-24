# AI_CONTEXT.md — Contexto condensado de Códigos (rama `Cereipo`)

> Leer este archivo al inicio de cualquier sesión sobre el repositorio **Códigos**.
> Documentación hermana: `ARCHITECTURE.md`, `BUSINESS_RULES.md`, `CEREIPO.md`, `INTEGRATION.md` y `modulos/`.

## 1. Propósito

Aplicación de la suite **Cereipo** (`codigo: "codigos"`, puerto local API `8102` / web `5192`, puerto contenedor `8053`) dedicada a **configurar, generar, consultar y anular códigos estructurados de documentos y planos** en dos modos equivalentes bajo una sola metodología de 8 segmentos:

1. **Modo manual (programa web)**: SPA React embebida en Cereipo Shell mediante `@cereipo/embed` + `@cereipo/ui`. El usuario elige año, número de proyecto, subproyecto, departamento, disciplina y tipo de documento; previsualiza y confirma con motivo obligatorio.
2. **Modo automático (API / servicio declarado D-16 `codigos/generar-codigos`)**: consumido por otras apps autorizadas del Shell (principalmente `Control de Documentos`) mediante HMAC-SHA256 (`X-Cereipo-*`), soportando reserva en lote, confirmación, generación inmediata, anulación, consulta exacta y lectura de catálogos activos.

La **sigla inicial de la organización (`{SIGLA_ORG}`)** se fija por tenant en `ConfiguracionOrganizacion` y **nunca** es seleccionable ni en la UI manual ni en la API automática: cada organización opera aislada por `organizacion_id` + RLS en PostgreSQL (`cereipo_codigos`).

## 2. Arquitectura y estructura Django (`backend/`)

Stack: Python 3.12 · Django 6.1 · Django REST Framework · PostgreSQL 17 (RLS obligatorio) · Redis · `cereipo-sso` `>=0.5.0` · React 19 + TypeScript + Vite 6.

Regla D-19 verificada en `.importlinter` (`lint-imports`, 5 contratos):

```
core          (validators, utils, exceptions, base_email.html) -> no importa apps de negocio ni integracion
integracion   (SSO, manifiesto, /salud/, ámbitos, maestros, avisos, RLS) -> no importa catalogos, registro ni api
catalogos     (ConfiguracionOrganizacion, CatalogoSegmento, services/) -> no importa registro ni api
registro      (ContadorSecuencia, CodigoRegistro, SolicitudAnulacion, services/, emails, MySQL cmd) -> solo importa catalogos.services
api           (servicio D-16 codigos/generar-codigos, serializers, views, bitácora) -> solo importa catalogos.services, registro.services e integracion.permissions
```

## 3. Reglas invariables

- **Unicidad y atomicidad**: `ContadorSecuencia` usa `select_for_update()` ordenado determinísticamente por combinación de segmentos para evitar saltos, colisiones y deadlocks bajo concurrencia; `clave_idempotencia` garantiza respuestas repetibles sin duplicar códigos.
- **Bloqueo de sigla**: una vez emitido o reservado el primer código de una organización, `ConfiguracionOrganizacion.bloqueada_por_codigos = True` impide cambiar `sigla`.
- **Anulación nunca borra ni reutiliza consecutivos**: `CodigoRegistro.estado = "anulado"` conserva el registro e historial auditable (`cereipo_sso.historial`), cierra solicitudes pendientes y emite aviso no bloqueante al Shell.
- **Rama `Main` intacta**: `Main` sigue siendo producción de PALDACA (`codigos.cpaldaca.com`). Toda la evolución Cereipo vive en la rama `Cereipo`.

## 4. Comandos de verificación rápida

```powershell
# Backend (desde Codigos/backend)
..\venv\Scripts\python.exe manage.py check
..\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
..\venv\Scripts\lint-imports
..\venv\Scripts\python.exe manage.py test

# Frontend (desde Codigos/frontend)
npm run lint
npm run build
```
