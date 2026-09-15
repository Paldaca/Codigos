from datetime import datetime, timedelta
import logging

from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.core.mail import BadHeaderError, EmailMultiAlternatives
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.encoding import force_str
from django.utils.timezone import localtime, now

from .avisos import avisar_solicitud_anulacion
from .decorators import requiere_modulo_paldaca
from .forms import BusquedaCodigoForm, CodigoForm
from .models import CodigoGenerado, SolicitudAnulacion
from .permissions import es_aprobador_codigos

logger = logging.getLogger('documentos')

LIST_PAGE_SIZE = 25


def _page(request, queryset, page_size=LIST_PAGE_SIZE):
    return Paginator(queryset, page_size).get_page(request.GET.get("page"))


def _calcular_codigo_y_consecutivo(cleaned_data):
    """Devuelve (codigo, consecutivo) a partir de datos validados del CodigoForm."""
    empresa = cleaned_data['empresa']
    año_completo = cleaned_data['año']
    año_dos_digitos = año_completo[-2:]
    numero_proyecto = cleaned_data['numero_proyecto']
    subproyecto = cleaned_data['subproyecto']
    departamento = cleaned_data['departamento']
    disciplina = cleaned_data['disciplina']
    tipo_documento = cleaned_data['tipo_documento']

    filtro_existente = CodigoGenerado.objects.filter(
        empresa=empresa,
        año=año_completo,
        numero_proyecto=numero_proyecto,
        subproyecto=subproyecto,
        departamento=departamento,
        disciplina=disciplina,
        tipo_documento=tipo_documento,
    )
    coincidencias = filtro_existente.count()
    consecutivo = coincidencias + 1
    codigo = (
        f"{empresa.sigla}-{año_dos_digitos}-{numero_proyecto}-{subproyecto}-"
        f"{departamento}-{disciplina}-{tipo_documento}-{consecutivo:03}"
    )
    logger.info(
        "Codigo calculado usuario=%s empresa=%s proyecto=%s subproyecto=%s consecutivo=%s",
        cleaned_data.get('usuario_log', 'n/a'),
        empresa.sigla,
        numero_proyecto,
        subproyecto,
        consecutivo,
    )
    return codigo, consecutivo


def _resumen_generador(form):
    """Lista (etiqueta, texto) para la vista previa; requiere form válido."""
    if not form.is_valid():
        return []
    d = form.cleaned_data
    depto_choices = dict(CodigoForm.DEPARTAMENTOS)
    disc_choices = dict(CodigoForm.DISCIPLINAS)
    tipo_choices = dict(CodigoForm.TIPOS_DOCUMENTO)
    return [
        ('Empresa', d['empresa'].nombre),
        ('Año', d['año']),
        ('Número de proyecto', d['numero_proyecto']),
        ('Subproyecto', d['subproyecto']),
        ('Departamento', depto_choices.get(d['departamento'], d['departamento'])),
        ('Disciplina', disc_choices.get(d['disciplina'], d['disciplina'])),
        ('Tipo de documento', tipo_choices.get(d['tipo_documento'], d['tipo_documento'])),
    ]


GENERADOR_SESSION_PREVIEW = 'generador_preview_data'
GENERADOR_SESSION_OK_CODIGO = 'generador_ok_codigo'
GENERADOR_SESSION_OK_WARNING = 'generador_ok_warning'
GENERADOR_SESSION_MOTIVO_BORRADOR = 'generador_motivo_borrador'


def _codigo_form_to_session_dict(form):
    """Solo con form.is_valid(). Valores serializables para reconstruir CodigoForm."""
    out = {}
    for name in form.fields:
        val = form.cleaned_data[name]
        out[name] = str(val.pk) if hasattr(val, 'pk') else val
    return out


def _preview_context_from_session(request, resultado_busqueda, motivo_draft=''):
    data = request.session.get(GENERADOR_SESSION_PREVIEW)
    if not data:
        return None
    form = CodigoForm(data)
    if not form.is_valid():
        request.session.pop(GENERADOR_SESSION_PREVIEW, None)
        return None
    codigo, _ = _calcular_codigo_y_consecutivo(form.cleaned_data)
    return {
        'form': form,
        'codigo_generado': None,
        'error': None,
        'codigo_previsualizacion': codigo,
        'previsualizacion_activa': True,
        'resumen_campos': _resumen_generador(form),
        'resultado_busqueda': resultado_busqueda,
        'motivo_draft': motivo_draft,
    }


@requiere_modulo_paldaca
def generar_codigo(request):
    codigo_generado = None
    resultado_busqueda = None
    error_formulario = None
    codigo_previsualizacion = None
    previsualizacion_activa = False
    resumen_campos = []
    motivo_draft = ''

    codigo_buscado = request.GET.get('buscar_codigo')
    if codigo_buscado:
        if CodigoGenerado.objects.filter(codigo=codigo_buscado).exists():
            resultado_busqueda = codigo_buscado
            logger.info("Busqueda codigo existente usuario=%s codigo=%s", request.user.username, codigo_buscado)
        else:
            resultado_busqueda = "no_existe"
            logger.warning("Busqueda codigo inexistente usuario=%s codigo=%s", request.user.username, codigo_buscado)

    if request.method == 'GET' and request.GET.get('guardado') == '1':
        codigo_generado = request.session.pop(GENERADOR_SESSION_OK_CODIGO, None)
        if not codigo_generado:
            return redirect('generar_codigo')
        error_formulario = request.session.pop(GENERADOR_SESSION_OK_WARNING, None)
        form = CodigoForm()
        context = {
            'form': form,
            'codigo_generado': codigo_generado,
            'error': error_formulario,
            'codigo_previsualizacion': None,
            'previsualizacion_activa': False,
            'resumen_campos': [],
            'resultado_busqueda': resultado_busqueda,
            'motivo_draft': '',
        }
        return render(request, 'generador_codigo.html', context)

    if request.method == 'GET' and request.GET.get('vista_previa') == '1':
        motivo_draft = request.session.pop(GENERADOR_SESSION_MOTIVO_BORRADOR, '')
        preview_ctx = _preview_context_from_session(request, resultado_busqueda, motivo_draft=motivo_draft)
        if not preview_ctx:
            messages.warning(
                request,
                'No hay una vista previa activa o los datos caducaron. Completa el formulario de nuevo.',
            )
            return redirect('generar_codigo')
        return render(request, 'generador_codigo.html', preview_ctx)

    if request.method == 'POST':
        paso = request.POST.get('paso', 'datos')
        logger.info("Generador POST usuario=%s paso=%s", request.user.username, paso)

        if paso == 'cancelar':
            request.session.pop(GENERADOR_SESSION_PREVIEW, None)
            request.session.pop(GENERADOR_SESSION_MOTIVO_BORRADOR, None)
            return redirect('generar_codigo')

        if paso == 'confirmar':
            data = request.session.get(GENERADOR_SESSION_PREVIEW)
            if not data:
                logger.warning("Confirmacion sin sesion de preview usuario=%s", request.user.username)
                messages.error(
                    request,
                    'La vista previa no está disponible. Genera la vista previa otra vez antes de confirmar.',
                )
                return redirect('generar_codigo')

            form = CodigoForm(data)
            if not form.is_valid():
                request.session.pop(GENERADOR_SESSION_PREVIEW, None)
                logger.warning("Preview invalida en confirmacion usuario=%s errores=%s", request.user.username, form.errors.as_json())
                messages.error(
                    request,
                    'No se pudo confirmar: los datos de la vista previa no son válidos. Vuelve a generar la vista previa.',
                )
                return redirect('generar_codigo')

            cleaned_data = form.cleaned_data.copy()
            cleaned_data['usuario_log'] = request.user.username
            codigo, consecutivo = _calcular_codigo_y_consecutivo(cleaned_data)
            motivo = request.POST.get('motivo', '').strip()
            if not motivo:
                request.session[GENERADOR_SESSION_MOTIVO_BORRADOR] = request.POST.get('motivo', '')
                logger.warning("Confirmacion sin motivo usuario=%s codigo=%s", request.user.username, codigo)
                messages.error(request, 'El motivo o asunto es obligatorio para guardar el código.')
                return redirect(f'{reverse("generar_codigo")}?vista_previa=1')

            empresa = form.cleaned_data['empresa']
            año_completo = form.cleaned_data['año']
            numero_proyecto = form.cleaned_data['numero_proyecto']
            subproyecto = form.cleaned_data['subproyecto']
            departamento = form.cleaned_data['departamento']
            disciplina = form.cleaned_data['disciplina']
            tipo_documento = form.cleaned_data['tipo_documento']

            try:
                CodigoGenerado.objects.create(
                    empresa=empresa,
                    año=año_completo,
                    numero_proyecto=numero_proyecto,
                    subproyecto=subproyecto,
                    departamento=departamento,
                    disciplina=disciplina,
                    tipo_documento=tipo_documento,
                    consecutivo=consecutivo,
                    codigo=codigo,
                    usuario=request.user,
                    motivo=motivo,
                )
                logger.info("Codigo guardado usuario=%s codigo=%s", request.user.username, codigo)
            except IntegrityError:
                request.session.pop(GENERADOR_SESSION_PREVIEW, None)
                logger.exception("IntegrityError al guardar codigo usuario=%s codigo=%s", request.user.username, codigo)
                messages.error(
                    request,
                    'No se pudo guardar el código. Intenta de nuevo o revisa si ya existe un registro igual.',
                )
                return redirect('generar_codigo')

            request.session.pop(GENERADOR_SESSION_PREVIEW, None)
            request.session.pop(GENERADOR_SESSION_MOTIVO_BORRADOR, None)

            email_warning = None
            nombre_empresa = empresa.nombre.strip()
            try:
                if nombre_empresa == 'SSAPI':
                    logo_empresa = 'ssapi.png'
                elif nombre_empresa == 'Paldaca':
                    logo_empresa = 'PaldacalogoyRif.png'
                elif nombre_empresa == 'Orinoco Energy':
                    logo_empresa = 'orinoco.png'
                elif nombre_empresa == 'Kinetic Scale Projectos':
                    logo_empresa = 'ksp.png'
                else:
                    logo_empresa = 'PaldacalogoyRif.png'

                logo_url = f'https://codigos.cpaldaca.com/static_codigos/img/{logo_empresa}'
                usuario = force_str(request.user.username)
                fecha = force_str(localtime(now()).strftime('%d/%m/%Y %H:%M'))
                destino = force_str(empresa.correo_notificacion)
                asunto = force_str('Nuevo Código generado')

                contexto_email = {
                    'usuario': usuario,
                    'fecha': fecha,
                    'codigo': codigo,
                    'motivo': motivo,
                    'logo_url': logo_url,
                }
                mensaje_texto = f"""
                Se ha generado un nuevo código:
                Usuario: {usuario}
                Fecha: {fecha}
                Código: {codigo}
                Motivo: {motivo}
                """
                mensaje_html = render_to_string('emails/nuevo_codigo.html', contexto_email)
                email = EmailMultiAlternatives(
                    asunto,
                    mensaje_texto,
                    'admin@codigos.cpaldaca.com',
                    [destino],
                )
                email.encoding = 'utf-8'
                email.attach_alternative(mensaje_html, 'text/html')
                email.send(fail_silently=False)
                logger.info(
                    "Correo enviado por codigo generado usuario=%s codigo=%s destino=%s",
                    request.user.username,
                    codigo,
                    destino,
                )
            except BadHeaderError:
                email_warning = 'Error: encabezado de correo inválido.'
                logger.exception("BadHeaderError enviando correo codigo=%s usuario=%s", codigo, request.user.username)
            except Exception as e:
                email_warning = f'El código fue guardado, pero el correo no pudo enviarse: {e}'
                logger.exception("Error enviando correo codigo=%s usuario=%s", codigo, request.user.username)

            request.session[GENERADOR_SESSION_OK_CODIGO] = codigo
            if email_warning:
                request.session[GENERADOR_SESSION_OK_WARNING] = email_warning
            return redirect(f'{reverse("generar_codigo")}?guardado=1')

        form = CodigoForm(request.POST)
        if form.is_valid():
            logger.info("Preview generada usuario=%s", request.user.username)
            request.session[GENERADOR_SESSION_PREVIEW] = _codigo_form_to_session_dict(form)
            return redirect(f'{reverse("generar_codigo")}?vista_previa=1')

        logger.warning("Formulario invalido en generador usuario=%s errores=%s", request.user.username, form.errors.as_json())
        error_formulario = 'Por favor, corrige los errores en el formulario.'
    else:
        form = CodigoForm()

    context = {
        'form': form,
        'codigo_generado': codigo_generado,
        'error': error_formulario,
        'codigo_previsualizacion': codigo_previsualizacion,
        'previsualizacion_activa': previsualizacion_activa,
        'resumen_campos': resumen_campos,
        'resultado_busqueda': resultado_busqueda,
        'motivo_draft': motivo_draft,
    }
    return render(request, 'generador_codigo.html', context)

@requiere_modulo_paldaca
def buscar_codigo(request):
    form = BusquedaCodigoForm(request.GET)
    resultados = CodigoGenerado.objects.none()  # No muestra nada hasta que se busque

    if request.GET and form.is_valid():
        codigo = form.cleaned_data.get('codigo')
        usuario = form.cleaned_data.get('usuario')
        fecha_inicio = form.cleaned_data.get('fecha_inicio')
        fecha_fin = form.cleaned_data.get('fecha_fin')

        resultados = CodigoGenerado.objects.all()

        if codigo:
            resultados = resultados.filter(codigo__icontains=codigo)
        if usuario:
            resultados = resultados.filter(usuario=usuario)
        if fecha_inicio:
            resultados = resultados.filter(fecha_creacion__gte=fecha_inicio)
        if fecha_fin:
            fecha_fin = datetime.combine(fecha_fin, datetime.max.time())
            resultados = resultados.filter(fecha_creacion__lte=fecha_fin)

        incluir_anulados = request.GET.get('ver_anulados') == 'on'
        if not incluir_anulados:
            resultados = resultados.filter(anulado=False)
        resultados = resultados.select_related('usuario').order_by('-fecha_creacion')
        logger.info("Busqueda avanzada usuario=%s total_resultados=%s", request.user.username, resultados.count())
        resultados = _page(request, resultados)

    return render(request, 'buscar_codigo.html', {
        'form': form,
        'resultados': resultados
    })
@requiere_modulo_paldaca
def lista_codigos(request):
    mostrar_todos = request.GET.get('todos')

    codigos = CodigoGenerado.objects.select_related('usuario').order_by('-fecha_creacion')
    page_size = LIST_PAGE_SIZE if mostrar_todos else 15
    codigos = _page(request, codigos, page_size=page_size)

    solicitudes_pendientes = list(
        SolicitudAnulacion.objects.filter(
            solicitante=request.user,
            procesada=False
        ).values_list('codigo_id', flat=True)
    )

    return render(request, 'lista_codigos.html', {
        'codigos': codigos,
        'mostrar_todos': mostrar_todos,
        'solicitudes_pendientes': solicitudes_pendientes,
    })


@requiere_modulo_paldaca
def anular_codigo(request, codigo_id):
    if request.method == 'POST':
        try:
            codigo = CodigoGenerado.objects.get(id=codigo_id)

            # Solo aprobadores o el mismo usuario
            if request.user == codigo.usuario or es_aprobador_codigos(request.user, request):
                if not codigo.anulado:
                    codigo.anulado = True
                    codigo.usuario_anulacion = request.user
                    codigo.fecha_anulacion = now()
                    codigo.save()

                    # Si existía una solicitud previa de este código, marcarla como procesada
                    SolicitudAnulacion.objects.filter(codigo=codigo, procesada=False).update(procesada=True)
                    logger.info("Codigo anulado usuario=%s codigo=%s", request.user.username, codigo.codigo)

                    return JsonResponse({'success': True})
                else:
                    logger.warning("Intento de anular codigo ya anulado usuario=%s codigo=%s", request.user.username, codigo.codigo)
                    return JsonResponse({'success': False, 'error': 'Ya está anulado'}, status=400)
            else:
                logger.warning("Intento no autorizado de anulacion usuario=%s codigo_id=%s", request.user.username, codigo_id)
                return JsonResponse({'success': False, 'error': 'No autorizado'}, status=403)
        except CodigoGenerado.DoesNotExist:
            logger.warning("Intento de anular codigo inexistente usuario=%s codigo_id=%s", request.user.username, codigo_id)
            return JsonResponse({'success': False, 'error': 'Código no encontrado'}, status=404)

    logger.warning("Metodo no permitido en anular_codigo usuario=%s metodo=%s", request.user.username, request.method)
    return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)


@requiere_modulo_paldaca
def solicitar_anulacion(request, codigo_id):
    if request.method == 'POST':
        try:
            motivo = request.POST.get('motivo', '').strip()

            if not motivo:
                logger.warning("Solicitud anulacion sin motivo usuario=%s codigo_id=%s", request.user.username, codigo_id)
                return JsonResponse({'success': False, 'error': 'El motivo no puede estar vacío.'}, status=400)

            codigo = CodigoGenerado.objects.get(id=codigo_id)

            existe = SolicitudAnulacion.objects.filter(
                codigo=codigo, solicitante=request.user, procesada=False
            ).exists()

            if existe:
                logger.warning("Solicitud anulacion duplicada usuario=%s codigo_id=%s", request.user.username, codigo_id)
                return JsonResponse({'success': False, 'error': 'Ya solicitaste la anulación'}, status=400)

            # Crear la solicitud
            solicitud = SolicitudAnulacion.objects.create(
                codigo=codigo,
                solicitante=request.user,
                motivo=motivo,
                fecha_solicitud=now()
            )
            logger.info("Solicitud anulacion creada usuario=%s codigo_id=%s", request.user.username, codigo_id)
            avisar_solicitud_anulacion(solicitud)

            return JsonResponse({'success': True})

        except CodigoGenerado.DoesNotExist:
            logger.warning("Solicitud anulacion codigo inexistente usuario=%s codigo_id=%s", request.user.username, codigo_id)
            return JsonResponse({'success': False, 'error': 'Código no encontrado'}, status=404)

    logger.warning("Metodo no permitido en solicitar_anulacion usuario=%s metodo=%s", request.user.username, request.method)
    return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)

@requiere_modulo_paldaca
def historial_anulaciones(request):
    anulaciones = (
        CodigoGenerado.objects.filter(anulado=True)
        .select_related("usuario_anulacion")
        .order_by("-fecha_anulacion")
    )
    return render(
        request,
        "historial_anulaciones.html",
        {"anulaciones": _page(request, anulaciones)},
    )

@requiere_modulo_paldaca
def solicitudes_anulacion_view(request):
    if not es_aprobador_codigos(request.user, request):
        logger.warning("Acceso denegado solicitudes_anulacion usuario=%s", request.user.username)
        return mostrar_error(request, mensaje="No tienes permiso para acceder a esta página.", codigo=403)
    
    if request.method == 'POST':
        solicitud_id = request.POST.get('solicitud_id')
        accion = request.POST.get('accion')  # anular o rechazar

        try:
            solicitud = SolicitudAnulacion.objects.select_related('codigo').get(id=solicitud_id, procesada=False)
            if accion == 'anular':
                solicitud.procesada = True
                solicitud.codigo.anulado = True
                solicitud.codigo.fecha_anulacion = now()
                solicitud.codigo.usuario_anulacion = request.user
                solicitud.codigo.save()
                solicitud.save()
                logger.info("Solicitud aprobada y codigo anulado usuario=%s solicitud_id=%s", request.user.username, solicitud_id)
                messages.success(request, f"Código {solicitud.codigo.codigo} anulado correctamente.")
            elif accion == 'rechazar':
                solicitud.procesada = True
                solicitud.save()
                logger.info("Solicitud anulacion rechazada usuario=%s solicitud_id=%s", request.user.username, solicitud_id)
                messages.info(request, f"Solicitud de anulación rechazada para el código {solicitud.codigo.codigo}.")
            else:
                logger.warning("Accion invalida en solicitudes_anulacion usuario=%s accion=%s", request.user.username, accion)
                messages.error(request, "Acción no válida.")

        except SolicitudAnulacion.DoesNotExist:
            logger.warning("Solicitud no encontrada usuario=%s solicitud_id=%s", request.user.username, solicitud_id)
            messages.error(request, "Solicitud no encontrada o ya procesada.")

        return redirect('solicitudes_anulacion')

    solicitudes = (
        SolicitudAnulacion.objects.select_related("codigo", "solicitante")
        .filter(procesada=False)
        .order_by("-fecha_solicitud")
    )

    return render(
        request,
        "solicitudes_anulacion.html",
        {"solicitudes": _page(request, solicitudes)},
    )

def mostrar_error(request, mensaje="Ha ocurrido un error", codigo=400):
    return render(request, 'error.html', {
        'mensaje': mensaje,
        'codigo': codigo
    }, status=codigo)