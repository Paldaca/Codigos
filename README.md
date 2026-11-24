# Códigos — Suite Cereipo

Aplicación de la suite **Cereipo** para la configuración, generación (manual y automática vía API), consulta y anulación de códigos de documentos y planos bajo la metodología estándar de 8 segmentos (`{SIGLA_ORG}-{AA}-{NN}-{S}-{DEPT}-{DISC}-{TIPO}-{CCC}`).

> **Nota sobre ramas:** La rama `Main` permanece congelada como producción de PALDACA (`codigos.cpaldaca.com`). La versión integrada a Cereipo se desarrolla en la rama `Cereipo`.

## Documentación

- [Índice de documentación (`docs/README.md`)](docs/README.md)
- [Contexto para asistentes e ingeniería (`docs/AI_CONTEXT.md`)](docs/AI_CONTEXT.md)
- [Arquitectura (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- [Reglas de negocio (`docs/BUSINESS_RULES.md`)](docs/BUSINESS_RULES.md)
- [Integración con Cereipo Shell (`docs/INTEGRATION.md`)](docs/INTEGRATION.md)
- [Guía de la rama Cereipo (`docs/CEREIPO.md`)](docs/CEREIPO.md)
- Documentación por módulo: [`integracion`](docs/modulos/integracion.md), [`catalogos`](docs/modulos/catalogos.md), [`registro`](docs/modulos/registro.md), [`api`](docs/modulos/api.md)

## Verificación local rápida

```powershell
# Backend (en Codigos/backend)
..\venv\Scripts\python.exe manage.py check
..\venv\Scripts\python.exe manage.py test
..\venv\Scripts\lint-imports

# Frontend (en Codigos/frontend)
npm run lint
npm run build
```
