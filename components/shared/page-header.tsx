import * as React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  actions?: React.ReactNode
}

export function PageHeader({ title, description, action, actions }: PageHeaderProps) {
  const slot = action ?? actions
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {slot && <div className="flex items-center gap-2">{slot}</div>}
    </div>
  )
}
