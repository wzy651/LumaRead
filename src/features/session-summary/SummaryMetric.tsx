import type { ReactElement } from 'react'

interface SummaryMetricProps {
  icon: ReactElement
  label: string
  value: string
}

export function SummaryMetric({ icon, label, value }: SummaryMetricProps) {
  return (
    <div className="summary-metric">
      <dt>
        <span aria-hidden="true" className="summary-metric__icon">{icon}</span>
        <span>{label}</span>
      </dt>
      <dd>{value}</dd>
    </div>
  )
}
