import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export function IconButton({ label, className = '', type = 'button', children, ...props }: IconButtonProps) {
  return <button aria-label={label} className={`ui-icon-button ${className}`.trim()} type={type} {...props}>{children}</button>
}
