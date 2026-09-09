interface CsvColumnSelectProps {
  label: string;
  headers: readonly string[];
  value: number;
  onChange: (index: number) => void;
  optional?: boolean;
  sample?: string | undefined;
}

/** Shared column selector for reviewed CSV imports. Values identify columns,
 * including repeated headers, rather than assuming a fixed question order. */
export default function CsvColumnSelect({ label, headers, value, onChange, optional, sample }: CsvColumnSelectProps) {
  return <label className="block min-w-0 text-xs font-bold text-slate-600">
    {label}
    <select aria-label={label} value={value} onChange={event => onChange(Number(event.target.value))}
      className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
      <option value={-1}>열 선택</option>
      {optional && <option value={-2}>사용 안 함</option>}
      {headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header || '(제목 없음)'}</option>)}
    </select>
    {sample !== undefined && <span className="mt-1.5 block break-words text-xs font-normal text-slate-500">예: {sample || '빈 응답'}</span>}
  </label>;
}
