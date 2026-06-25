import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
}

export function Card({ padded = true, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={['bg-snow-card rounded-xl border border-timber/20 shadow-sm', padded ? 'p-6' : '', className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['mb-4', className].join(' ')} {...rest}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={['text-lg font-semibold text-navy', className].join(' ')} {...rest}>
      {children}
    </h2>
  )
}
