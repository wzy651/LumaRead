import type { ElementType, HTMLAttributes } from 'react'
import './ui.css'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
}

/** A visual container; it defaults to a neutral div, not an unnamed section landmark. */
export function Card({ as: Element = 'div', className = '', ...props }: CardProps) {
  return <Element className={`ui-card ${className}`.trim()} {...props} />
}
