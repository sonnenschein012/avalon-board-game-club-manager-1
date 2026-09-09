import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, FileUp, Loader2, X } from 'lucide-react';
import Papa from 'papaparse';
import type { Member } from '../types';
import { attendanceFields, detectAttendanceMapping, previewAttendanceCsv,
  type AttendanceField, type AttendanceImportInput, type AttendancePreviewRow } from '../domain/attendance/csvParser';
import CsvColumnSelect from './CsvColumnSelect';

interface Props {
  members: readonly Member[];
  existingCount: number;
  groupCount: number;
  onClose: () => void;
  onConfirm: (input: AttendanceImportInput) => Promise<boolean>;
}

export default function AttendanceCsvImportModal({ members, existingCount, groupCount, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestId = useRef({ value: 0 });
  const submitting = useRef(false);
  const [input, setInput] = useState<AttendanceImportInput | null>(null);
  const [filename, setFilename] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const preview = useMemo(() => input ? previewAttendanceCsv(input, members) : null, [input, members]);
  const filtered = preview?.rows.filter(row => !errorsOnly || row.errors.length) ?? [];
  const visible = filtered.slice(page * 20, (page + 1) * 20);
  const busy = saving || reading;
  const needsConfirmation = existingCount > 0 || groupCount > 0;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const requests = requestId.current;
    const previouslyFocused = document.activeElement;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      requests.value++;
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  const loadFile = (file?: File) => {
    if (!file || busy) return;
    const current = ++requestId.current.value;
    setInput(null); setError(''); setConfirmed(false); setPage(0); setErrorsOnly(false);
    setFilename(file.name); setReading(true);
    Papa.parse<string[]>(file, {
      // Preserve blank rows so errors retain their original CSV record numbers.
      complete: result => {
        if (current !== requestId.current.value) return;
        setReading(false);
        if (result.errors.length) {
          setError(`CSV를 읽지 못했습니다: ${result.errors[0]!.message}`);
          return;
        }
        const headers = result.data[0] ?? [];
        if (!headers.some(header => header.trim())) {
          setError('첫 행에 열 제목이 있는 CSV 파일을 선택해주세요.');
          return;
        }
        setInput({ headers, rows: result.data.slice(1), mapping: detectAttendanceMapping(headers) });
      },
      error: () => {
        if (current !== requestId.current.value) return;
        setReading(false); setError('파일을 읽지 못했습니다. 파일을 다시 선택해주세요.');
      },
    });
  };

  const confirm = async () => {
    if (submitting.current || busy || !input || !preview?.canImport || (needsConfirmation && !confirmed)) return;
    submitting.current = true; setSaving(true); setError('');
    try {
      if (await onConfirm(input)) onClose();
      else setError('명단을 반영하지 못했습니다. 내용을 확인한 뒤 다시 시도해주세요.');
    } catch {
      setError('명단을 반영하지 못했습니다. 다시 시도해주세요.');
    } finally { submitting.current = false; setSaving(false); }
  };

  return <dialog ref={dialogRef} aria-labelledby="attendance-import-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    className="fixed inset-0 m-auto h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-hidden bg-white p-0 text-navy backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-3xl sm:shadow-2xl">
    <div className="flex h-full max-h-[100dvh] flex-col sm:max-h-[92dvh]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
        <div><h2 id="attendance-import-title" className="font-black">참석자 파일 등록</h2><p className="mt-1 text-xs text-slate-500">열 연결 · 미리보기 · 명단 반영</p></div>
        <button type="button" aria-label="닫기" disabled={saving} onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        <label className={`flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 p-4 text-sm font-bold text-slate-600 hover:border-gold ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {reading ? <Loader2 size={22} className="shrink-0 animate-spin" /> : <FileUp size={22} className="shrink-0" />}
          <span className="min-w-0"><span className="block break-all">{filename || 'CSV 파일 선택'}</span><span className="mt-1 block text-xs font-normal text-slate-500">{filename ? '다른 파일을 선택하려면 누르세요' : '설문 응답 시트에서 내려받은 파일을 선택하세요'}</span></span>
          <input type="file" accept=".csv,text/csv" aria-label="참석자 CSV 파일" disabled={busy} className="sr-only" onChange={event => { loadFile(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {input && <>
          <fieldset disabled={busy} className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <legend className="sr-only">파일 열 연결</legend>
            <h3 className="text-sm font-black">1. 파일 열 연결</h3>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-slate-500">자동으로 연결된 질문을 확인하세요. 질문이 바뀌었다면 열을 직접 선택할 수 있습니다. 이름에 학번이 포함되어 있으면 별도 학번 열은 사용하지 않아도 됩니다.</p>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(attendanceFields) as AttendanceField[]).map(field => <CsvColumnSelect key={field}
                label={attendanceFields[field]} headers={input.headers} value={input.mapping[field]} optional={field !== 'name'}
                sample={input.mapping[field] >= 0 ? input.rows.find(row => row.some(value => value.trim()))?.[input.mapping[field]] : undefined}
                onChange={index => { setInput({ ...input, mapping: { ...input.mapping, [field]: index } }); setConfirmed(false); setPage(0); }} />)}
            </div>
          </fieldset>
          {!!preview?.mappingErrors.length && <div role="alert" className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">{preview.mappingErrors.map((message, index) => <p key={index}>{message}</p>)}</div>}
          {preview && !preview.mappingErrors.length && <section aria-label="참석자 미리보기" className="space-y-3">
            <h3 className="text-sm font-black">2. 가져올 명단 확인</h3>
            <div aria-live="polite" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary label="전체" value={`${preview.counts.total}명`} />
              <Summary label="음료 입력" value={`${preview.counts.drinks}명`} />
              <Summary label="뒤풀이 참석" value={`${preview.counts.attending}명`} />
              <Summary label="오류" value={`${preview.counts.errors}명`} error={preview.counts.errors > 0} />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">뒤풀이 불참 {preview.counts.absent}명 · 미응답/미확인 {preview.counts.unanswered}명 · 미등록 {preview.counts.unregistered}명</p>
            {!!preview.counts.errors && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700">오류가 있는 행을 확인해주세요. 열 연결을 변경하거나 원본 CSV를 수정해 다시 선택하면 검토 결과가 갱신됩니다.</p>}
            <label className="flex min-h-11 w-fit items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={errorsOnly} onChange={event => { setErrorsOnly(event.target.checked); setPage(0); }} className="size-4 accent-navy" />오류 행만 보기</label>
            {!preview.counts.total && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">가져올 응답이 없습니다. 기존 명단은 유지됩니다.</p>}
            <div className="space-y-3 sm:hidden">{visible.map(row => <article key={row.sourceRowNumber} className={`rounded-2xl border p-4 ${row.errors.length ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
              <div className="mb-3 flex items-start justify-between gap-3"><strong className="break-words text-sm">{row.data.studentIdPrefix && `${row.data.studentIdPrefix}학번 `}{row.data.name || '이름 없음'}</strong><span className="shrink-0 text-xs text-slate-500">{row.sourceRowNumber}행</span></div>
              <dl className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt className="text-slate-500">음료</dt><dd className="break-words">{row.data.drink || '미응답 / 사용 안 함'}</dd><dt className="text-slate-500">뒤풀이</dt><dd>{partyLabel(row)}</dd><dt className="text-slate-500">희망</dt><dd className="whitespace-pre-wrap break-words">{row.data.request || '없음'}</dd></dl>
              <div className="mt-3 border-t border-slate-100 pt-3"><RowStatus row={row} /></div>
            </article>)}</div>
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
              <table className="w-full table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['행', '학번 · 이름', '음료', '뒤풀이', '희망사항', '확인'].map((title, index) => <th key={title} className={`px-3 py-3 font-bold ${index === 0 ? 'w-12' : ''}`}>{title}</th>)}</tr></thead>
                <tbody>{visible.map(row => <tr key={row.sourceRowNumber} className={`border-t border-slate-100 align-top ${row.errors.length ? 'bg-red-50/40' : ''}`}>
                  <td className="px-3 py-3 text-slate-500">{row.sourceRowNumber}</td><td className="break-words px-3 py-3 font-bold">{row.data.studentIdPrefix} {row.data.name || '이름 없음'}</td><td className="break-words px-3 py-3">{row.data.drink || '—'}</td><td className="px-3 py-3">{partyLabel(row)}</td><td className="whitespace-pre-wrap break-words px-3 py-3">{row.data.request || '—'}</td><td className="break-words px-3 py-3"><RowStatus row={row} /></td>
                </tr>)}</tbody>
              </table>
            </div>
            {filtered.length > 20 && <nav aria-label="미리보기 페이지" className="flex items-center justify-between gap-3 text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">이전</button><span>{page + 1} / {Math.ceil(filtered.length / 20)}</span><button disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(page + 1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">다음</button></nav>}
          </section>}
        </>}
      </div>
      <footer className="shrink-0 space-y-3 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        {needsConfirmation && <label className="flex min-h-11 items-start gap-3 text-xs leading-relaxed text-slate-600"><input type="checkbox" disabled={busy || !preview?.canImport} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-navy" /><span>기존 명단 {existingCount}명을 새 명단으로 교체합니다.{groupCount > 0 && ` 현재 조 편성 ${groupCount}개도 초기화됩니다.`} 내용을 확인했습니다.</span></label>}
        <div className="flex gap-2 sm:justify-end"><button disabled={saving} onClick={onClose} className="min-h-11 rounded-xl px-5 text-sm font-bold text-slate-500 hover:bg-slate-50">취소</button><button onClick={() => void confirm()} disabled={busy || !preview?.canImport || (needsConfirmation && !confirmed)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-bold text-white hover:bg-gold disabled:opacity-40 sm:flex-none">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? '반영 중…' : `${preview?.counts.total ?? 0}명 명단 반영`}</button></div>
      </footer>
    </div>
  </dialog>;
}

const partyLabel = (row: AttendancePreviewRow) => row.data.afterparty === true ? '참석' : row.data.afterparty === false ? '불참' : row.rawAfterparty ? '확인 필요' : '미응답 / 사용 안 함';
function RowStatus({ row }: { row: AttendancePreviewRow }) {
  return <div className="space-y-1 text-xs leading-relaxed">{row.errors.map(message => <p key={message} className="text-red-700"><AlertCircle size={12} className="mr-1 inline" />{message}</p>)}{row.warnings.map(message => <p key={message} className="text-amber-800">{message}</p>)}{!row.errors.length && !row.warnings.length && <span className="text-emerald-700">정상</span>}</div>;
}
function Summary({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return <div className={`rounded-xl p-3 ${error ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-navy'}`}><p className="text-xs">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}
