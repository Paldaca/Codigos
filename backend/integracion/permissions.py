"""Permisos RBAC (cereipo_sso) y permisos D-16 para servicios declarados."""

from __future__ import annotations

from rest_framework import exceptions
from rest_framework.permissions import BasePermission

from cereipo_sso.drf import ServicioAPIMixin, TieneIdentidad, permiso


def tiene_permiso(identidad, slug: str) -> bool:
    return bool(identidad is not None and identidad.puede(slug))


def requiere_permiso(slug: str):
    """Permiso DRF por organización (para apps con requiere_proyecto=False)."""
    return permiso(slug)


class EsAdminOConPermiso(BasePermission):
    """Permite acceso al administrador de la organización o a quien tenga el permiso indicado."""

    def __init__(self, slug: str):
        self.slug = slug

    def has_permission(self, request, view):
        identidad = getattr(request, "cereipo", None)
        if identidad is None:
            raise exceptions.NotAuthenticated()
        if identidad.es_admin_organizacion or identidad.puede(self.slug):
            return True
        raise exceptions.PermissionDenied("No tienes permiso para realizar esta acción.")


__all__ = [
    "EsAdminOConPermiso",
    "ServicioAPIMixin",
    "TieneIdentidad",
    "requiere_permiso",
    "tiene_permiso",
]
