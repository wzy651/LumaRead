import { useState } from 'react'
import type { AnnotationColor, ReaderAnnotation } from '../../../domain/annotation'

export function AnnotationEditor({ annotation, quote, color, note, onSave, onCancel, onDelete, onColor }: { annotation?: ReaderAnnotation; quote: string; color: AnnotationColor; note?: string; onSave: (note: string, color: AnnotationColor) => void; onCancel: () => void; onDelete?: () => void; onColor: (color: AnnotationColor) => void }) {
  const [value, setValue] = useState(note ?? '')
  return <div className="annotation-editor"><blockquote>{quote}</blockquote><label>Note<textarea aria-label="Note" autoFocus maxLength={4000} onChange={(event) => setValue(event.target.value)} value={value} /></label><div className="annotation-editor__colors"><span>Color</span>{(['lavender', 'amber', 'sage'] as const).map((item) => <button aria-label={`Use ${item}`} aria-pressed={color === item} className={`selection-toolbar__color selection-toolbar__color--${item} ${color === item ? 'is-selected' : ''}`} key={item} onClick={() => onColor(item)} type="button" />)}</div><div className="annotation-editor__actions"><button onClick={() => onSave(value, color)} type="button">Save</button><button onClick={onCancel} type="button">Cancel</button>{annotation && onDelete && <button className="annotation-editor__delete" onClick={onDelete} type="button">Delete</button>}</div></div>
}
