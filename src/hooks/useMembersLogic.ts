import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Member, Session, Game } from '../types';
import { useFirestore } from './useFirestore';
import { toast } from 'sonner';
import Papa from 'papaparse';

export const AVAILABLE_GENRES = ['카드', '파티', '협상', '전략', '타일', '경매', '추리', '수학', '마피아', '심리', '협력', '주사위', '순발력', '퍼즐', '그림', '기억력', '배팅', '타이쿤', '퀴즈', '단어'];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
export const defaultSemester = (currentMonth >= 3 && currentMonth <= 8) 
  ? `${currentYear}-1` 
  : (currentMonth >= 9 ? `${currentYear}-2` : `${currentYear - 1}-2`);
export const defaultDormantSemester = defaultSemester.endsWith('-1') 
  ? `${defaultSemester.split('-')[0]}-2` 
  : `${parseInt(defaultSemester.split('-')[0] || '') + 1}-1`;

export interface MemberFormData {
  name: string;
  nickname: string;
  studentId: string;
  phone: string;
  gender: '남' | '여' | '기타';
  semester: string;
  preferredGenre: string[];
  memo: string;
  isBoardMember: boolean;
  dormantSemester: string;
}

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

  const handleBulkDormant = async (dormantSemester: string) => {
    if (selectedDocs.size === 0) return;
    if (!dormantSemester) {
      toast.error('휴면 지정 학기를 입력해주세요.');
      return;
    }
    try {
      const promises = Array.from(selectedDocs).map((id: string) => {
        return updateDoc(doc(db, 'members', id), {
          status: '휴면',
          dormantSemester: dormantSemester
        });
      });
      await Promise.all(promises);
      toast.success(`${selectedDocs.size}명의 동아리원이 휴면 명부로 전환되었습니다.`);
      setSelectedDocs(new Set());
    } catch (error) {
      console.error(error);
      toast.error('휴면 전환 중 오류가 발생했습니다.');
    }
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

            const dataToSave = {
              name,
              nickname: row['닉네임']?.trim() || `${studentId} ${name}`,
              studentId,
              phone: row['연락처']?.trim() || '',
              gender: row['성별']?.trim() === '여' ? '여' : (row['성별']?.trim() === '기타' ? '기타' : '남'),
              semester,
              preferredGenre,
              memo: row['메모']?.trim() || '',
              status: '활동',
              isBoardMember: false,
              dormantSemester: ''
            };

            await addDoc(collection(db, 'members'), {
              ...dataToSave,
              createdAt: serverTimestamp(),
            });
            addedCount++;
          }
          if (addedCount > 0) {
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
    
    // 동명이인 + 학번 완전 동일 방어 로직
    const isDuplicate = members.some(m => 
      m.name === formData.name && 
      m.studentId === formData.studentId && 
      m.id !== editingId
    );

    if (isDuplicate) {
      toast.error('오류: 이름과 학번이 완전히 동일한 멤버가 이미 존재합니다. 구분을 위해 이름 뒤에 기호(예: 홍길동A)를 추가해주세요.');
      return;
    }

    try {
      const nickname = formData.nickname.trim() || `${formData.studentId} ${formData.name}`;
      const status = formData.dormantSemester ? '휴면' : '활동';
      const _dormantSemester = formData.dormantSemester || '';
      const dataToSave = { ...formData, nickname, status, dormantSemester: _dormantSemester };

      if (editingId) {
        await updateDoc(doc(db, 'members', editingId), dataToSave);
        toast.success('멤버 정보가 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'members'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast.success('새로운 멤버가 등록되었습니다.');
      }
      setIsAdding(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `members/${editingId || ''}`);
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'members', itemToDelete.id));
      toast.success('멤버가 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${itemToDelete.id}`);
      toast.error('삭제 중 오류가 발생했습니다.');
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
    return members.filter(m => {
      const isDormant = m.status === '휴면';
      const matchesTab = currentTab === '활동' ? !isDormant : isDormant;
      if (!matchesTab) return false;

      const matchesSearch = (m.name || '').includes(searchTerm) || (m.studentId || '').includes(searchTerm) || (m.nickname || '').includes(searchTerm);
      const matchesGender = genderFilter === '전체' || m.gender === genderFilter;
      const matchesSemester = semesterFilter === '전체' || m.semester === semesterFilter;
      const matchesGenre = genreFilter === '전체' || (Array.isArray(m.preferredGenre) && m.preferredGenre.includes(genreFilter));
      return matchesSearch && matchesGender && matchesSemester && matchesGenre;
    });
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
    resetForm,
    filteredMembers,
    semesters,
  };
}
