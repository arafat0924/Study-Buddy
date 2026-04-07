'use client';

import { useI18n } from '@/i18n';

export const SIZE_PRESETS = [
  { key: 'none', bytes: null, label: '' },
  { key: '100k', bytes: 100_000, label: '100 KB' },
  { key: '200k', bytes: 200_000, label: '200 KB' },
  { key: '300k', bytes: 300_000, label: '300 KB' },
  { key: '500k', bytes: 500_000, label: '500 KB' },
  { key: '1m', bytes: 1_000_000, label: '1 MB' },
  { key: '1.5m', bytes: 1_500_000, label: '1.5 MB' },
  { key: '2m', bytes: 2_000_000, label: '2 MB' },
  { key: '3m', bytes: 3_000_000, label: '3 MB' },
  { key: '5m', bytes: 5_000_000, label: '5 MB' },
  { key: '10m', bytes: 10_000_000, label: '10 MB' },
  { key: 'custom', bytes: null, label: '' },
] as const;

export type SizeKey = (typeof SIZE_PRESETS)[number]['key'];
export type SizeValue = { key: SizeKey; customMB: string };

export function sizeBytes(v: SizeValue): number | null {
  if (v.key === 'custom') {
    const mb = parseFloat(v.customMB.replace(',', '.'));
    return Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1_000_000) : null;
  }
  return SIZE_PRESETS.find((p) => p.key === v.key)?.bytes ?? null;
}

export const sameSize = (a: SizeValue, b: SizeValue) =>
  a.key === b.key && (a.key !== 'custom' || a.customMB === b.customMB);

export default function SizeSelect({
  value, onChange, disabled, small, id,
}: { value: SizeValue; onChange: (v: SizeValue) => void; disabled?: boolean; small?: boolean; id?: string }) {
  const { d } = useI18n();
  return (
    <div className="size-select">
      <select
        id={id}
        className={`field${small ? ' field-sm' : ''}`}
        value={value.key}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, key: e.target.value as SizeKey })}
      >
        {SIZE_PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.key === 'none' ? d.common.noLimit : p.key === 'custom' ? d.common.custom : p.label}
          </option>
        ))}
      </select>
      {value.key === 'custom' && (
        <div className="size-custom">
          <input
            className={`field${small ? ' field-sm' : ''}`}
            type="number"
            inputMode="decimal"
            min={0.05}
            step={0.05}
            placeholder="0.8"
            value={value.customMB}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, customMB: e.target.value })}
            aria-label="MB"
          />
          <span>MB</span>
        </div>
      )}
    </div>
  );
}
