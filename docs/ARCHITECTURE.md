# ARCHITECTURE.md — Repositorio Códigos (Cereipo)

> Stack: Python 3.12 · Django 6.1 · DRF · PostgreSQL 17 (RLS) · Redis · `cereipo-sso` `>=0.5.0` · React 19 + TypeScript + Vite 6.

---

## 1. Propósito y enfoque dual

**Códigos** centraliza la nomenclatura documental de cada organización en Cereipo bajo la metodología única de 8 segmentos (`{SIGLA_ORG}-{AA}-{NN}-{S}-{DEPT}-{DISC}-{TIPO}-{CCC}`), operando de dos formas sobre el mismo motor transaccional:

1. **Programa manual embebido**: SPA React (`frontend/`) servida en el mismo dominio que su API y embebida en el Shell mediante `@cereipo/embed`.
2. **Servicio declarado entre apps (`codigos/generar-codigos`)**: API REST HMAC-SHA256 (`backend/api/`) para asignación automática (por ejemplo desde Control de Documentos al crear documentos o planos).

---

## 2. Diagrama general en Cereipo

```
                    +-------------------------------------+
                    |            Cereipo Shell            |
                    |  SSO · Permisos · Catálogo D-16     |
                    |  Maestros (codigos.catalogos)       |
                    +------------------+------------------+
                                       |
          +----------------------------+----------------------------+
          | iframe + JWT/Identidad                                  | HMAC servicio D-16
          v (usuario manual)                                        v (Control de Documentos, etc.)
+---------------------------------------------------------------------------------------------------+
|                                         Códigos (esta app)                                        |
|  SPA React (frontend/)  <--->  integracion / catalogos / registro  <--->  api (generar-codigos)   |
|                                        |                                                          |
|                         PostgreSQL cereipo_codigos (RLS por org_id)                               |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Estructura de carpetas

```
Codigos/
├── Dockerfile                      # Imagen única: stage Node build SPA -> Django + Gunicorn (:8053)
├── requirements.txt                # Runtime (Django, DRF, psycopg, redis, gunicorn, cereipo-sso>=0.5.0, PyMySQL)
├── requirements-dev.txt            # Herramientas de desarrollo (import-linter)
├── docs/                           # Contexto, arquitectura, reglas de negocio, integración y módulos
├── frontend/                       # SPA React + TypeScript + Vite (@cereipo/embed, @cereipo/ui)
│   └── src/
│       ├── context/                # IdentidadContext (yo, salud, configOrg, permisos)
│       ├── services/               # http.ts, catalogos.ts, registro.ts, integracion.ts
│       ├── components/             # BannerSinSigla, FranjaEstado, InsigniaOrganizacion, ModalAnulacion, VistaPreviaCodigo
│       └── pages/                  # inicio/, generador/, registro/, anulaciones/, catalogos/, administracion/
└── backend/
    ├── .importlinter               # 5 contratos arquitectónicos (D-19)
    ├── manage.py / healthcheck.py
    ├── config/                     # settings.py, db.py, entorno.py, peticion.py, spa.py, urls.py
    ├── core/                       # Validadores, utilidades, ErrorNegocio, templates/core/base_email.html
    ├── integracion/                # Manifiesto, SSO, /salud/, ámbitos, maestros del Shell, avisos, tests RLS
    ├── catalogos/                  # ConfiguracionOrganizacion, CatalogoSegmento, services/ (org, segmentos, semillas, publicación)
    ├── registro/                   # ContadorSecuencia, CodigoRegistro, SolicitudAnulacion, services/, emails, migrar_desde_mysql
    └── api/                        # Endpoint /api/servicios/generar-codigos/* + bitácora D-16
```

---

## 4. Fronteras internas (D-19 / `.importlinter`)

Todas las apps de negocio exponen su lógica en `services/` y conservan la separación estándar de Django:

- **`core`** no importa ninguna app del proyecto.
- **`integracion`** no importa `catalogos`, `registro` ni `api`.
- **`catalogos`** no importa `registro` ni `api`.
- **`registro`** solo consume `catalogos.services`, nunca `catalogos.models` directamente.
- **`api`** no define modelos propios y solo consume `catalogos.services`, `registro.services` e `integracion.permissions`.
