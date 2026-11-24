"""Utilidades compartidas de formato y normalización."""

from __future__ import annotations


def formatear_codigo(
    *,
    sigla: str,
    anio: str,
    numero_proyecto: str,
    subproyecto: str,
    departamento: str,
    disciplina: str,
    tipo_documento: str,
    consecutivo: int,
    digitos_consecutivo: int = 3,
) -> str:
    anio_dos = str(anio)[-2:]
    formato_consecutivo = f"{int(consecutivo):0{digitos_consecutivo}d}"
    return (
        f"{sigla}-{anio_dos}-{numero_proyecto}-{subproyecto}-"
        f"{departamento}-{disciplina}-{tipo_documento}-{formato_consecutivo}"
    )


def texto_limpio(valor: object, maximo: int = 500) -> str:
    return str(valor or "").strip()[:maximo]
