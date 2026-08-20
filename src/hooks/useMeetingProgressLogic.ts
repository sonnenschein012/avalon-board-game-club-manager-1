import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { StoredSessionGroup, Member, Game, Session, Attendee } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';
import { captureBoard } from '../services/captureService';
import { recommendGames, getMemberPlayedGames } from '../domain/recommendation/recommendGames';
import { isSameName } from '../domain/matching/isSameName';
import { calculateGridPositions, generateDrinkOrderText } from '../domain/meeting/progressHelpers';

export function useMeetingProgressLogic(onSidebarToggle?: (collapsed: boolean) => void) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [dailyPlanning, setDailyPlanning] = useState<{name: string, date: string, groups: StoredSessionGroup[]} | null>(null);

  const { data: members } = useFirestore<Member>('members');
  const { data: games } = useFirestore<Game>('games', orderBy('title', 'asc'));
  const { data: sessions } = useFirestore<Session>('sessions');
  const { data: attendees } = useFirestore<Attendee>('attendees');
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [groupRecModes, setGroupRecModes] = useState<Record<string, 'SIZE_MATCH' | 'NEW_GAME' | 'POPULAR' | 'HIDDEN' | 'RANDOM'>>({});
  const [groupSearchedGameIds, setGroupSearchedGameIds] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<'dashboard' | 'notice' | 'drink'>('dashboard');
  const [cardStyles, setCardStyles] = useState<Record<string, { bgColor: string }>>({});
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardPositions, setCardPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [guides, setGuides] = useState<{ x: number | null, y: number | null }>({ x: null, y: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const captureRef = useRef<HTMLDivElement>(null);

  const [boardScale, setBoardScale] = useState(1);
  const [boardHeight, setBoardHeight] = useState(800);
  const viewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onSidebarToggle) {
      onSidebarToggle(activeTab === 'notice');
    }
  }, [activeTab, onSidebarToggle]);

  useEffect(() => {
    let max = 800;
    Object.entries(cardPositions).forEach(([id, pos]: [string, {x: number, y: number}]) => {
      const el = document.getElementById(`card-${id}`);
      const h = el ? el.offsetHeight : 250;
      max = Math.max(max, pos.y + h + 45);
    });
    setBoardHeight(max);
  }, [cardPositions]);

  useEffect(() => {
    const checkScale = () => {
      if (viewContainerRef.current) {
        const w = viewContainerRef.current.clientWidth;
        setBoardScale(Math.min(1, (w - 32) / 1600));
      }
    };
    checkScale();
    window.addEventListener('resize', checkScale);
    return () => window.removeEventListener('resize', checkScale);
  }, [isFullscreen, activeTab]);

  const handleCapture = async () => {
    if (!captureRef.current) return;
    await captureBoard(captureRef.current, boardHeight, selectedDate || 'temp');
  };

  const handleCopyDrinkOrder = () => {
    if (!dailyPlanning) return;
    const getter = (m: Member | undefined) => m ? getAttendeeFromMember(m) : undefined;
    const text = generateDrinkOrderText(dailyPlanning.groups, members, getter);
    navigator.clipboard.writeText(text).then(() => {
      toast.success('복사되었습니다.');
    }).catch(() => {
      toast.error('복사에 실패했습니다.');
    });
  };

  useEffect(() => {
    if (!selectedDate) return;
    const docRef = doc(db, 'DailyPlannings', selectedDate);
    const unsubPlanning = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setDailyPlanning(snap.data() as {name: string, date: string, groups: StoredSessionGroup[]});
      } else {
        setDailyPlanning(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `DailyPlannings/${selectedDate}`);
    });
    return () => unsubPlanning();
  }, [selectedDate]);

  useEffect(() => {
    if (dailyPlanning) {
      setTimeout(() => {
        setCardPositions(calculateGridPositions(dailyPlanning.groups));
      }, 50);
    }
  }, [dailyPlanning]);

  const handleGridAlign = () => {
    if (!dailyPlanning) return;
    setCardPositions(calculateGridPositions(dailyPlanning.groups));
  };

  const handleUpdateGroupName = async (groupId: string) => {
    if (!dailyPlanning) return;
    
    try {
      const updatedGroups = dailyPlanning.groups.map(g => 
        g.id === groupId ? { ...g, name: editingGroupName } : g
      );
      
      const docRef = doc(db, 'DailyPlannings', selectedDate || 'temp');
      await updateDoc(docRef, { groups: updatedGroups });
      setEditingGroupId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `DailyPlannings/${selectedDate}`);
    }
  };

  const getAttendeeFromMember = (m: Member) => {
    const matchedAttendees = attendees.filter(a => isSameName(a.name, m.name));
    const mPrefix = m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x=>x) || '';
    return matchedAttendees.find(a => !a.studentIdPrefix || a.studentIdPrefix === mPrefix || m.studentId?.startsWith(a.studentIdPrefix)) || matchedAttendees[0];
  };

  const handleRecommendGames = (groupMembers: Member[], mode: 'SIZE_MATCH' | 'NEW_GAME' | 'POPULAR' | 'HIDDEN' | 'RANDOM', seed: number = 0) => {
    return recommendGames(groupMembers, mode, seed, sessions, games, members);
  };

  const handleGetMemberPlayedGames = (memberId: string) => {
    return getMemberPlayedGames(memberId, sessions);
  };

  const colors = [
    '#E11D48',
    '#2563EB',
    '#16A34A',
    '#D97706',
    '#9333EA',
    '#C026D3',
    '#0284C7',
    '#0D9488',
  ];

  return {
    selectedDate, setSelectedDate,
    customTitle, setCustomTitle,
    dailyPlanning,
    members, games, sessions, attendees,
    selectedMember, setSelectedMember,
    groupRecModes, setGroupRecModes,
    groupSearchedGameIds, setGroupSearchedGameIds,
    activeTab, setActiveTab,
    cardStyles, setCardStyles,
    editingCardId, setEditingCardId,
    cardPositions, setCardPositions,
    guides, setGuides,
    isFullscreen, setIsFullscreen,
    editingGroupId, setEditingGroupId,
    editingGroupName, setEditingGroupName,
    captureRef, viewContainerRef,
    boardScale, boardHeight,
    
    handleCapture,
    handleCopyDrinkOrder,
    handleGridAlign,
    handleUpdateGroupName,
    getAttendeeFromMember,
    memberPlayedGames: handleGetMemberPlayedGames,
    recommendGames: handleRecommendGames,
    colors
  };
}
