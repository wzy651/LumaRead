import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'primary', className = '', type = 'button', disabled, ...props }: ButtonProps) {
  return <button className={`ui-button ui-button--${variant} ${className}`.trim()} disabled={disabled} type={type} {...props} />
}
