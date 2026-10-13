import type { ReactNode } from 'react'
import { PAGE_SIZES } from '../lib/layout'
import type { Orientation, PageSizeId, Settings } from '../types'

type Props = {
  settings: Settings
  /** The orientation Auto picked, or null when there's nothing to lay out yet. */
  resolvedOrientation: Orientation | null
  onChange: (settings: Settings) => void
  onReset: () => void
}

export function SettingsPanel({ settings, resolvedOrientation, onChange, onReset }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Layout"
        hint={
          settings.mode === 'auto'
            ? 'Rows sized to each photo’s shape. Nothing is cropped.'
            : 'Equal-sized cells in a neat grid.'
        }
      >
        <Segmented
          value={settings.mode}
          onChange={(v) => set('mode', v)}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'grid', label: 'Grid' },
          ]}
        />
      </Field>

      {settings.mode === 'grid' && (
        <Field
          label="Photos in cells"
          hint={
            settings.fit === 'fit'
              ? 'Shows each whole photo; cells may have white bars.'
              : 'Fills each cell; edges of photos may be cropped.'
          }
        >
          <Segmented
            value={settings.fit}
            onChange={(v) => set('fit', v)}
            options={[
              { value: 'fit', label: 'Fit' },
              { value: 'fill', label: 'Fill' },
            ]}
          />
        </Field>
      )}

      <Field label="Page size">
        <Segmented
          value={settings.pageSize}
          onChange={(v) => set('pageSize', v)}
          options={(Object.keys(PAGE_SIZES) as PageSizeId[]).map((id) => ({
            value: id,
            label: PAGE_SIZES[id].label,
          }))}
        />
      </Field>

      <Field
        label="Orientation"
        hint={
          settings.orientation === 'auto' && resolvedOrientation
            ? `Using ${resolvedOrientation}, the best fit for these photos`
            : undefined
        }
      >
        <Segmented
          value={settings.orientation}
          onChange={(v) => set('orientation', v)}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
        />
      </Field>

      <Slider
        label="Margin"
        value={settings.marginMm}
        max={25}
        onChange={(v) => set('marginMm', v)}
        hint={settings.marginMm < 5 ? 'Most printers can’t print right to the edge.' : undefined}
      />
      <Slider label="Spacing" value={settings.gapMm} max={15} onChange={(v) => set('gapMm', v)} />

      <button
        type="button"
        onClick={onReset}
        className="self-start text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
      >
        Reset to defaults
      </button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-stone-100 p-1" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
            opt.value === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Slider({
  label,
  value,
  max,
  hint,
  onChange,
}: {
  label: string
  value: number
  max: number
  hint?: string
  onChange: (value: number) => void
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="flex-1 accent-blue-600"
        />
        <span className="w-12 text-right text-sm tabular-nums text-stone-700">{value} mm</span>
      </div>
    </Field>
  )
}
