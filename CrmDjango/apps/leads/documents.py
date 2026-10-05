"""Student profile documents (#34–#41). Replacing a document keeps the old file in history."""
import os

from django.http import FileResponse

from common.exceptions import ApiError

from .activity import log_activity
from .models import DOCUMENT_TYPES, LeadDocument, LeadProfile

PDF_IMG = ({'.pdf', '.jpg', '.jpeg', '.png'}, 5)
IMG = ({'.jpg', '.jpeg', '.png'}, None)
# type → (allowed extensions, max MB, mandatory: True | False | 'if_completed')
RULES = {
    'aadhaar': (PDF_IMG[0], 5, True),
    'pan': (PDF_IMG[0], 5, False),
    'class10_marksheet': (PDF_IMG[0], 5, True),
    'class12_marksheet': (PDF_IMG[0], 5, True),
    'graduation_marksheet': (PDF_IMG[0], 5, 'if_completed'),
    'photo': (IMG[0], 2, True),
    'signature': (IMG[0], 1, True),
    'resume': ({'.pdf', '.doc', '.docx'}, 5, False),
}


def applicable(profile: LeadProfile | None) -> dict[str, bool]:
    """type → mandatory now? Graduation result is mandatory only when the UG status is Completed."""
    ug_status = (((profile.academic if profile else None) or {}).get('ug') or {}).get('status')
    return {t: (m == 'if_completed' and ug_status == 'Completed') or m is True for t, (_, _, m) in RULES.items()}


def doc_json(d: LeadDocument) -> dict:
    return {
        '_id': d.id, 'type': d.doc_type, 'typeLabel': DOCUMENT_TYPES[d.doc_type], 'fileName': d.original_name,
        'contentType': d.content_type, 'size': d.size, 'isCurrent': d.is_current,
        'uploadedBy': d.uploaded_by.name if d.uploaded_by_id and d.uploaded_by else None, 'uploadedAt': d.created_at,
    }


def list_documents(actor, lead_id: str) -> dict:
    from .services import find_lead_for_actor

    find_lead_for_actor(actor, lead_id)
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    docs = LeadDocument.objects.filter(lead_id=lead_id).select_related('uploaded_by').order_by('-created_at')
    mandatory = applicable(profile)
    slots = []
    for t, (exts, max_mb, _) in RULES.items():
        current = next((d for d in docs if d.doc_type == t and d.is_current), None)
        slots.append({
            'type': t, 'label': DOCUMENT_TYPES[t], 'mandatory': mandatory[t], 'accept': sorted(exts), 'maxMb': max_mb,
            'current': doc_json(current) if current else None,
            'history': [doc_json(d) for d in docs if d.doc_type == t and not d.is_current],
        })
    done = all(s['current'] for s in slots if s['mandatory'])
    return {'documents': slots, 'complete': done}


def upload(actor, lead_id: str, doc_type: str, file) -> dict:
    from .profile import refresh_completion
    from .services import find_lead_for_actor

    find_lead_for_actor(actor, lead_id)
    profile = LeadProfile.objects.filter(lead_id=lead_id).first()
    if profile and profile.locked:
        raise ApiError.unprocessable('The profile is locked after the declaration. Ask an admin to unlock it.')
    if doc_type not in RULES:
        raise ApiError.bad_request('Validation failed', {'type': 'Unknown document type'})
    if file is None:
        raise ApiError.bad_request('Validation failed', {'file': 'Choose a file'})
    exts, max_mb, _ = RULES[doc_type]
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in exts:
        allowed = '/'.join(sorted(e.lstrip('.').upper() for e in exts if e != '.jpeg'))
        raise ApiError.bad_request('Validation failed', {'file': f'{DOCUMENT_TYPES[doc_type]} must be {allowed}'})
    if file.size > max_mb * 1024 * 1024:
        raise ApiError.bad_request('Validation failed', {'file': f'{DOCUMENT_TYPES[doc_type]} can be at most {max_mb} MB'})

    previous = LeadDocument.objects.filter(lead_id=lead_id, doc_type=doc_type, is_current=True).first()
    if previous:
        previous.is_current = False
        previous.save(update_fields=['is_current', 'updated_at'])
    doc = LeadDocument.objects.create(
        lead_id=lead_id, doc_type=doc_type, file=file, original_name=file.name[:255],
        content_type=getattr(file, 'content_type', '') or 'application/octet-stream', size=file.size,
        uploaded_by_id=actor.id,
    )
    verb = 'replaced' if previous else 'uploaded'
    log_activity(lead_id, 'document', f'Document {verb}: {DOCUMENT_TYPES[doc_type]}', description=file.name,
                 actor_id=actor.id, actor_name=actor.name,
                 data={'documentId': doc.id, 'type': doc_type, 'fileName': file.name,
                       'previous': previous.original_name if previous else None})
    refresh_completion(lead_id)
    return doc_json(doc)


def download(actor, lead_id: str, document_id: str):
    from .services import find_lead_for_actor

    find_lead_for_actor(actor, lead_id)
    doc = LeadDocument.objects.filter(pk=document_id, lead_id=lead_id).first()
    if not doc:
        raise ApiError.not_found('Document not found')
    return FileResponse(doc.file.open('rb'), as_attachment=True, filename=doc.original_name, content_type=doc.content_type)
