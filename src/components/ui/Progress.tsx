import './ui.css'

interface ProgressProps {
  value: number
  label: string
}

export function Progress({ value, label }: ProgressProps) {
  const boundedValue = Math.min(100, Math.max(0, value))
  return <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={boundedValue} className="ui-progress" role="progressbar"><span style={{ width: `${boundedValue}%` }} /></div>
}
