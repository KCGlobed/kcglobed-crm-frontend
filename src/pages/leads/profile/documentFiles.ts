import type { LeadDocumentFile } from '../../../types/models'

/** A lead document's file (download; add ?inline=1 to show it in the browser). */
export const documentPath = (leadId: string, documentId: string) => `/leads/${leadId}/documents/${documentId}/download`

/** Every current document of the lead merged into one PDF (cover page + a bookmark per document). */
export const documentsExportPath = (leadId: string) => `/leads/${leadId}/documents/export`

export const isImageDocument = (doc: Pick<LeadDocumentFile, 'contentType'>) => doc.contentType.startsWith('image/')

/** A picked file the cropper can open (the document types accept JPG and PNG images). */
export const isCroppableFile = (file: File) => ['image/jpeg', 'image/png'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name)
