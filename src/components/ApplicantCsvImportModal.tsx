import { useMemo, useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import Papa from 'papaparse';
import { previewApplicantCsv } from '../domain/interviews/applicantCsv';
import type { ApplicantImportRow } from '../services/interviewsService';

interface ApplicantCsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: ApplicantImportRow[]) => Promise<boolean>;
}

export default function ApplicantCsvImportModal({ open, onClose, onConfirm }: ApplicantCsvImportModalProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({ applicantNumber: -1, name: -1, phone: -1 });
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const mappingError = useMemo(() => {
    if (headers.length === 0) return null;
    const indexes = Object.values(mapping);
    if (indexes.some(value => value < 0)) return '지원자 번호, 이름, 연락처 열을 모두 연결해주세요.';
    if (new Set(indexes).size !== indexes.length) return '세 필수 항목은 서로 다른 CSV 열에 연결해야 합니다.';
    return null;
  }, [headers.length, mapping]);

  const preview = useMemo(() => {
    if (headers.length === 0 || mappingError) return null;
    try { return previewApplicantCsv(headers, rows, mapping); } catch { return null; }
  }, [headers, mapping, mappingError, rows]);

  if (!open) return null;

  const loadFile = (file?: File) => {
    if (!file) return;
    setFileError(null);
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: result => {
        if (result.errors.length > 0) {
          setFileError(`CSV를 읽는 중 오류가 발생했습니다: ${result.errors[0]?.message ?? '파일 형식을 확인해주세요.'}`);
          setHeaders([]);
          setRows([]);
          return;
        }
        const matrix = result.data.map(row => row.map(cell => String(cell ?? '')));
        const nextHeaders = matrix[0] ?? [];
        setHeaders(nextHeaders);
        setRows(matrix.slice(1));
        const locate = (terms: string[]) => nextHeaders.findIndex(header => terms.some(term => header.toLowerCase().includes(term)));
        setMapping({
          applicantNumber: locate(['지원자', '생년월일', '번호', 'id']),
          name: locate(['이름', '성명', 'name']),
          phone: locate(['연락처', '전화', 'phone', 'mobile']),
        });
      },
      error: error => setFileError(`CSV 파일을 읽지 못했습니다: ${error.message}`),
    });
  };

  const confirm = async () => {
    if (fileError || !preview || preview.validRowCount === 0 || preview.invalidRowCount > 0) return;
    if (!window.confirm(`${preview.validRowCount}명의 지원자와 개인 링크를 최종 생성할까요?`)) return;
    setImporting(true);
    try {
      const ok = await onConfirm(preview.stagedRows);
      if (ok) onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-black text-navy">지원자 CSV 등록</h2><p className="text-[10px] uppercase text-slate-400">Map columns · Preview · Confirm</p></div><button onClick={onClose} className="p-2 text-slate-400"><X size={18} /></button></div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-7 text-sm font-bold text-slate-500 hover:border-gold hover:text-navy"><FileUp size={18} />CSV 파일 선택<input type="file" accept=".csv,text/csv" className="hidden" onChange={event => loadFile(event.target.files?.[0])} /></label>
          {(fileError || mappingError) && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{fileError ?? mappingError}</p>}
          {headers.length > 0 && <section className="rounded-2xl bg-slate-50 p-4"><h3 className="mb-3 text-xs font-black text-navy">필수 열 연결</h3><div className="grid gap-3 sm:grid-cols-3">{(['applicantNumber', 'name', 'phone'] as const).map(key => <label key={key} className="text-[11px] font-bold text-slate-500">{key === 'applicantNumber' ? '지원자 번호/생년월일' : key === 'name' ? '이름' : '연락처'}<select value={mapping[key]} onChange={event => setMapping({ ...mapping, [key]: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value={-1}>열 선택</option>{headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `(빈 열 ${index + 1})`}</option>)}</select></label>)}</div></section>}
          {preview && <><div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[10px] text-slate-400">전체</p><p className="font-black text-navy">{preview.totalRows}</p></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-[10px] text-emerald-600">등록 가능</p><p className="font-black text-emerald-700">{preview.validRowCount}</p></div><div className="rounded-xl bg-red-50 p-3 text-center"><p className="text-[10px] text-red-600">오류</p><p className="font-black text-red-700">{preview.invalidRowCount}</p></div></div>{preview.errors.length > 0 && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{preview.errors.slice(0, 8).map((item, index) => <p key={index}>{item.sourceRowNumber}행: {item.error.message}</p>)}</div>}<div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr><th className="px-3 py-2">행</th><th className="px-3 py-2">번호</th><th className="px-3 py-2">이름</th><th className="px-3 py-2">연락처</th><th className="px-3 py-2">보존 필드</th></tr></thead><tbody>{preview.stagedRows.slice(0, 20).map(row => <tr key={row.sourceRowNumber} className="border-t border-slate-50"><td className="px-3 py-2">{row.sourceRowNumber}</td><td className="px-3 py-2">{row.applicantNumber}</td><td className="px-3 py-2 font-bold">{row.name}</td><td className="px-3 py-2">{row.phone}</td><td className="px-3 py-2 text-slate-400">{row.applicationData.length}개</td></tr>)}</tbody></table></div></>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><button onClick={onClose} className="px-4 text-xs font-bold text-slate-500">취소</button><button onClick={confirm} disabled={Boolean(fileError) || !preview || preview.invalidRowCount > 0 || preview.validRowCount === 0 || importing} className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-black text-white hover:bg-gold disabled:opacity-40">{importing && <Loader2 size={14} className="animate-spin" />}최종 등록</button></div>
      </div>
    </div>
  );
}
