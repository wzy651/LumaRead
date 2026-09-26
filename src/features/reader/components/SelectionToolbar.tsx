import type { AnnotationColor } from '../../../domain/annotation'

export function SelectionToolbar({ isMobile, onHighlight, onAddNote, onCancel, onLookup }: { isMobile: boolean; onHighlight: (color: AnnotationColor) => void; onAddNote: () => void; onCancel: () => void; onLookup?: () => void }) {
  return <div aria-label="Highlight selection" className={`selection-toolbar ${isMobile ? 'selection-toolbar--mobile' : ''}`} role="toolbar">
    {onLookup && <button onPointerDown={(event) => event.preventDefault()} onClick={onLookup} type="button">理解</button>}
    <button data-autofocus="true" onClick={() => onHighlight('lavender')} type="button">Highlight</button>
    <button aria-label="Highlight lavender" className="selection-toolbar__color selection-toolbar__color--lavender" onClick={() => onHighlight('lavender')} type="button" />
    <button aria-label="Highlight amber" className="selection-toolbar__color selection-toolbar__color--amber" onClick={() => onHighlight('amber')} type="button" />
    <button aria-label="Highlight sage" className="selection-toolbar__color selection-toolbar__color--sage" onClick={() => onHighlight('sage')} type="button" />
    <button onClick={onAddNote} type="button">Add note</button>
    <button onClick={onCancel} type="button">Cancel</button>
  </div>
}
