import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  collection,
  query,
  getDocs,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Member, Game } from '../types';
import { useFirestore } from './useFirestore';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import { defaultMemberNickname, formatMemberPhone, normalizeMemberName, normalizeStudentYear } from '../domain/members/memberIdentity';
import { useAsyncActionState } from './useAsyncActionState';
import { createMemberFormData, defaultSemester, type MemberFormData } from '../domain/members/memberForm';
import { parseMemberCsv } from '../domain/members/memberCsv';
import { sortDormantMembers } from '../domain/members/dormantMemberOrder';

export function useMembersLogic() {
  const { data: members } = useFirestore<Member>('members', 'name');
  const { data: games } = useFirestore<Game>('games');
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('전체');
  const [semesterFilter, setSemesterFilter] = useState('전체');
  const [genreFilter, setGenreFilter] = useState('전체');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
  const [currentTab, setCurrentTab] = useState<'활동' | '휴면'>('활동');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const { runAction, isPending } = useAsyncActionState();

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
      await Promise.all(Array.from(selectedDocs).map(id => updateDoc(doc(db, 'members', id), {
        status: '휴면',
        dormantSemester,
      })));
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

  const [formData, setFormData] = useState<MemberFormData>(() => createMemberFormData());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { members: importedMembers, skippedCount } = parseMemberCsv(results.data, members, defaultSemester);
          const operations: Parameters<typeof commitBatchesInChunks>[1] = importedMembers.map(member => ({
            type: 'set',
            ref: doc(collection(db, 'members')),
            data: { ...member, createdAt: serverTimestamp() },
          }));
          if (operations.length > 0) {
            await commitBatchesInChunks(db, operations);
            toast.success(`${importedMembers.length}명의 멤버가 추가되었습니다.${skippedCount > 0 ? ` (중복 및 누락 제외 ${skippedCount}명)` : ''}`);
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
      const dormantSemester = formData.dormantSemester || '';
      const status = dormantSemester ? '휴면' : '활동';
      const dataToSave = { ...formData, studentId, phone: formatMemberPhone(formData.phone), nickname, status, dormantSemester };

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
    setFormData(createMemberFormData());
    setEditingId(null);
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
  };

  const toggleEditing = (member: Member) => {
    if (editingId === member.id) {
      setEditingId(null);
      return;
    }
    setEditingId(member.id);
    setFormData(createMemberFormData(member));
    setIsAdding(false);
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
    editingId,
    viewingMember, setViewingMember,
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
    memberBulkPending: isPending('member-bulk'),
    resetForm,
    startAdding,
    toggleEditing,
    filteredMembers,
    semesters,
  };
}
