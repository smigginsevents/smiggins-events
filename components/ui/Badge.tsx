import { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'live' | 'draft' | 'complete' | 'ready' | 'round'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-timber/15 text-timber',
  live: 'bg-rust/15 text-rust animate-pulse',
  draft: 'bg-navy/10 text-navy/60',
  complete: 'bg-pine/15 text-pine',
  ready: 'bg-mustard/20 text-mustard',
  round: 'bg-rust text-white font-display tracking-wide text-base px-3 py-1',
}

export function Badge({ variant = 'default', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full text-xs font-medium px-2.5 py-0.5',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}
