import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-navy">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'rounded-md border px-3 py-2 text-sm text-navy placeholder:text-navy/40',
            'focus:outline-none focus:ring-2 focus:ring-rust focus:border-transparent',
            'disabled:opacity-50 disabled:bg-snow',
            error ? 'border-red-400' : 'border-timber/40 bg-snow-card',
            className,
          ].join(' ')}
          {...rest}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
