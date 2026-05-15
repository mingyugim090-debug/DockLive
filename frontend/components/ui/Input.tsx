import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={['input-shell w-full rounded-[16px] px-4 py-3 text-sm', props.className ?? ''].join(' ')} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={['input-shell w-full rounded-[18px] px-4 py-3 text-sm', props.className ?? ''].join(' ')} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={['input-shell w-full rounded-[16px] px-4 py-3 text-sm', props.className ?? ''].join(' ')} />;
}
