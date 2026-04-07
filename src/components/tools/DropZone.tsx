'use client';

import { useRef, useState, type ReactNode } from 'react';
import Icon, { type IconName } from '../Icon';

export default function DropZone({
  accept, onFiles, title, hint, icon = 'upload', disabled, compact, children,
}: {
  accept: string;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: string;
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const files = Array.from(list);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`drop${over ? ' is-over' : ''}${compact ? ' is-compact' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
    >
      <span className="drop-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      {hint && <small>{hint}</small>}
      {children}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => { take(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
