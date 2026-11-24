"""Sincroniza clientes, proyectos y disciplinas desde el Shell (tarea 5.5)."""

from django.core.management.base import BaseCommand

from integracion.services.maestros import refrescar_maestros_shell


class Command(BaseCommand):
    help = "Consume incrementalmente los datos maestros del Shell hacia MaestroShellCache."

    def handle(self, *args, **options):
        resumen = refrescar_maestros_shell()
        self.stdout.write(self.style.SUCCESS(f"Sincronización completada: {resumen}"))
