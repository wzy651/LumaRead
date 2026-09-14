import type { HTMLAttributes } from 'react'
import './ui.css'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`.trim()} {...props} />
}
