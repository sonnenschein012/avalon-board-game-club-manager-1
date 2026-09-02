import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Member, Session, Game } from '../types';
import { useFirestore } from './useFirestore';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import { defaultMemberNickname, formatMemberPhone, normalizeMemberName, normalizeStudentYear } from '../domain/interviews/memberRegistration';
import { useAsyncActionState } from './useAsyncActionState';
import { AVAILABLE_GENRES, defaultSemester, type MemberFormData } from '../domain/members/memberForm';
import { sortDormantMembers } from '../domain/members/dormantMemberOrder';

export { AVAILABLE_GENRES, defaultDormantSemester, defaultSemester } from '../domain/members/memberForm';
export type { MemberFormData } from '../domain/members/memberForm';

export function useMembersLogic() {
  const { data: members } = useFirestore<Member>('members', orderBy('name', 'asc'));
  const { data: games } = useFirestore<Game>('games');
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [memberSessions, setMemberSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('전체');
  const [semesterFilter, setSemesterFilter] = useState('전체');
  const [genreFilter, setGenreFilter] = useState('전체');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
  const [currentTab, setCurrentTab] = useState<'활동' | '휴면'>('활동');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const { runAction, isPending, anyPending } = useAsyncActionState();

  useEffect(() => {
    setSelectedDocs(new Set());
  }, [currentTab]);

  const handleBulkDormant = async (dormantSemester: string) => {
    if (selectedDocs.size === 0) return;
    if (!dormantSemester) {
      toast.error('휴면 지정 학기를 입력해주세요.');
      return;
    }
    if (isPending('member-bulk')) return;
    const count = selectedDocs.size;
    await runAction('member-bulk', async () => {
      const promises = Array.from(selectedDocs).map((id: string) => {
        return updateDoc(doc(db, 'members', id), {
          status: '휴면',
          dormantSemester: dormantSemester
        });
      });
      await Promise.all(promises);
      setSelectedDocs(new Set());
    }, {
      successMessage: `${count}명의 동아리원이 휴면 명부로 전환되었습니다.`,
      errorMessage: '휴면 전환 중 오류가 발생했습니다.',
      onError: console.error,
    });
  };

  const handleBulkDormantSemesterChange = async (dormantSemester: string) => {
    if (selectedDocs.size === 0) return;
    if (!dormantSemester) {
      toast.error('휴면 학기를 입력해주세요.');
      return;
    }
    if (isPending('member-bulk')) return;
    const count = selectedDocs.size;
    await runAction('member-bulk', async () => {
      await Promise.all(Array.from(selectedDocs).map((id: string) => updateDoc(doc(db, 'members', id), {
        dormantSemester,
      })));
      setSelectedDocs(new Set());
    }, {
      successMessage: `${count}명의 휴면 학기가 변경되었습니다.`,
      errorMessage: '휴면 학기 변경 중 오류가 발생했습니다.',
      onError: console.error,
    });
  };

  const handleBulkRestoreActive = async () => {
    if (selectedDocs.size === 0) return;
    if (isPending('member-bulk')) return;
    const count = selectedDocs.size;
    await runAction('member-bulk', async () => {
      await Promise.all(Array.from(selectedDocs).map((id: string) => updateDoc(doc(db, 'members', id), {
        status: '활동',
        dormantSemester: '',
      })));
      setSelectedDocs(new Set());
    }, {
      successMessage: `${count}명의 동아리원이 활동 명부로 복원되었습니다.`,
      errorMessage: '활동 명부 복원 중 오류가 발생했습니다.',
      onError: console.error,
    });
  };

  const [formData, setFormData] = useState<MemberFormData>({ 
    name: '', nickname: '', studentId: '', phone: '', 
    gender: '남', semester: defaultSemester, preferredGenre: [], memo: '',
    isBoardMember: false,
    dormantSemester: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (viewingMember) {
      const fetchHistory = async () => {
        try {
          const q = query(collection(db, 'sessions'), orderBy('date', 'desc'));
          const snap = await getDocs(q);
          const filtered = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Session))
            .filter(s => s.groups.some(g => g.memberIds.includes(viewingMember.id)));
          setMemberSessions(filtered);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'sessions');
          toast.error('활동 기록을 불러오는 중 오류가 발생했습니다.');
        }
      };
      fetchHistory();
    }
  }, [viewingMember]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          let addedCount = 0;
          let skippedCount = 0;
          const existingKeys = new Set(members.map(m => `${m.name}_${m.studentId}`));
          const operations: Parameters<typeof commitBatchesInChunks>[1] = [];

          for (const row of rows) {
            const name = row['이름']?.trim();
            const studentId = row['학번']?.trim();
            if (!name || !studentId) continue;
            
            const key = `${name}_${studentId}`;
            if (existingKeys.has(key)) {
              skippedCount++;
              continue;
            }
            existingKeys.add(key);

            let semester = row['가입학기']?.trim() || defaultSemester;
            semester = semester.replace(/jan/i, '1').replace(/feb/i, '2');

            let preferredGenre: string[] = [];
            const genreStr = row['선호장르']?.trim();
            if (genreStr) {
               preferredGenre = genreStr.split(',').map((g: string) => g.trim()).filter((g: string) => AVAILABLE_GENRES.includes(g));
            }

            const rawStatus = row['상태']?.trim();
            const dormantSemester = row['휴면학기']?.trim() || '';
            const status = rawStatus === '휴면' || dormantSemester ? '휴면' : '활동';
            const rawBoard = row['임원여부']?.trim().toLowerCase();
            const isBoardMember = rawBoard === 'y' || rawBoard === '임원' || rawBoard === 'true';

            const dataToSave = {
              name,
              nickname: row['닉네임']?.trim() || `${studentId} ${name}`,
              studentId,
              phone: row['연락처']?.trim() || '',
              gender: row['성별']?.trim() === '여' ? '여' : (row['성별']?.trim() === '기타' ? '기타' : '남'),
              semester,
              preferredGenre,
              memo: row['메모']?.trim() || '',
              status,
              isBoardMember,
              dormantSemester,
              createdAt: serverTimestamp(),
            };

            const docRef = doc(collection(db, 'members'));
            operations.push({
              type: 'set',
              ref: docRef,
              data: dataToSave,
            });
            addedCount++;
          }
          if (operations.length > 0) {
            await commitBatchesInChunks(db, operations);
            toast.success(`${addedCount}명의 멤버가 추가되었습니다.${skippedCount > 0 ? ` (중복 및 누락 제외 ${skippedCount}명)` : ''}`);
          } else {
            toast.info(`추가할 멤버가 없습니다. (중복 및 누락 ${skippedCount}명)`);
          }
        } catch (error) {
          console.error(error);
          toast.error('파일 업로드 중 오류가 발생했습니다.');
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error: Error) => {
        toast.error('CSV 파싱 오류: ' + error.message);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending('member-save')) return;
    const studentId = normalizeStudentYear(formData.studentId);
    const nickname = formData.nickname.trim() || defaultMemberNickname(formData.name, studentId);
    const isDuplicate = members.some(member =>
      normalizeMemberName(member.name) === normalizeMemberName(formData.name)
      && normalizeStudentYear(member.studentId) === studentId
      && member.nickname.trim().toLocaleLowerCase('ko-KR') === nickname.toLocaleLowerCase('ko-KR')
      && member.id !== editingId
    );

    if (isDuplicate) {
      toast.error('이름과 학번이 같은 부원이 있습니다. 동명이인을 구분할 수 있도록 다른 닉네임을 입력해주세요.');
      return;
    }

    const isEditing = Boolean(editingId);
    await runAction('member-save', async () => {
      const status = formData.dormantSemester ? '휴면' : '활동';
      const _dormantSemester = formData.dormantSemester || '';
      const dataToSave = { ...formData, studentId, phone: formatMemberPhone(formData.phone), nickname, status, dormantSemester: _dormantSemester };

      if (editingId) {
        await updateDoc(doc(db, 'members', editingId), dataToSave);
      } else {
        await addDoc(collection(db, 'members'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
      }
      setIsAdding(false);
      resetForm();
    }, {
      successMessage: isEditing ? '멤버 정보가 수정되었습니다.' : '새로운 멤버가 등록되었습니다.',
      errorMessage: '멤버 정보를 저장하지 못했습니다.',
      onError: (error) => handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, `members/${editingId || ''}`),
    });
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    if (isPending('member-delete')) return;
    const member = itemToDelete;
    try {
      await runAction('member-delete', async () => {
      const linkedApplicants = await getDocs(query(collection(db, 'interviewApplicants'), where('memberId', '==', member.id)));
      const batch = writeBatch(db);
      batch.delete(doc(db, 'members', member.id));
      linkedApplicants.docs.forEach(snapshot => batch.update(snapshot.ref, {
        memberId: null,
        memberRegisteredAt: null,
        memberRegisteredBy: null,
        updatedAt: serverTimestamp(),
      }));
      await batch.commit();
      }, {
        successMessage: '멤버가 삭제되었습니다.',
        errorMessage: '멤버를 삭제하지 못했습니다.',
        onError: (error) => handleFirestoreError(error, OperationType.DELETE, `members/${member.id}`),
      });
    } finally {
      setItemToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', nickname: '', studentId: '', phone: '', 
      gender: '남', semester: defaultSemester, preferredGenre: [], memo: '',
      isBoardMember: false,
      dormantSemester: ''
    });
    setEditingId(null);
  };

  const filteredMembers = useMemo(() => {
    const filtered = members.filter(m => {
      const isDormant = m.status === '휴면';
      const matchesTab = currentTab === '활동' ? !isDormant : isDormant;
      if (!matchesTab) return false;

      const matchesSearch = (m.name || '').includes(searchTerm) || (m.studentId || '').includes(searchTerm) || (m.nickname || '').includes(searchTerm);
      const matchesGender = genderFilter === '전체' || m.gender === genderFilter;
      const matchesSemester = semesterFilter === '전체' || m.semester === semesterFilter;
      const matchesGenre = genreFilter === '전체' || (Array.isArray(m.preferredGenre) && m.preferredGenre.includes(genreFilter));
      return matchesSearch && matchesGender && matchesSemester && matchesGenre;
    });
    return currentTab === '휴면' ? sortDormantMembers(filtered) : filtered;
  }, [members, searchTerm, genderFilter, semesterFilter, genreFilter, currentTab]);

  const semesters = useMemo(() => {
    const s = new Set(members.map(m => m.semester).filter(val => val && val !== '전체'));
    return ['전체', ...Array.from(s).sort().reverse()];
  }, [members]);

  return {
    members,
    games,
    isAdding, setIsAdding,
    editingId, setEditingId,
    viewingMember, setViewingMember,
    memberSessions, setMemberSessions,
    searchTerm, setSearchTerm,
    genderFilter, setGenderFilter,
    semesterFilter, setSemesterFilter,
    genreFilter, setGenreFilter,
    itemToDelete, setItemToDelete,
    currentTab, setCurrentTab,
    selectedDocs, setSelectedDocs,
    formData, setFormData,
    fileInputRef,
    handleFileUpload,
    handleSubmit,
    handleDelete,
    handleBulkDormant,
    handleBulkDormantSemesterChange,
    handleBulkRestoreActive,
    memberSaving: isPending('member-save'),
    memberDeleting: isPending('member-delete'),
    memberActionPending: anyPending,
    memberBulkPending: isPending('member-bulk'),
    resetForm,
    filteredMembers,
    semesters,
  };
}
