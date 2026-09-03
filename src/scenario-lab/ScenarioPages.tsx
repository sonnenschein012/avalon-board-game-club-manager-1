import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { CalendarClock, ClipboardList, Plus, Users } from 'lucide-react';
import GroupsCanvas from '../components/GroupsCanvas';
import InterviewSchedulePanel from '../components/InterviewSchedulePanel';
import MemberFilters from '../components/MemberFilters';
import MemberList from '../components/MemberList';
import PageHeader from '../components/PageHeader';
import UnassignedPool from '../components/UnassignedPool';
import type { AutoAssignmentResult } from '../domain/interviews/autoAssignment';
import { createMemberFormData, type MemberFormData } from '../domain/members/memberForm';
import type { Attendee, InterviewAssignment, Member, SessionGroup } from '../types';
import {
  createAttendanceFixture,
  createInterviewFixture,
  createMembersFixture,
  type AttendanceScenarioState,
  type InterviewScenarioState,
  type MembersScenarioState,
} from './fixtures';

const emptyMemberForm: MemberFormData = {
  name: '', nickname: '', studentId: '', phone: '', gender: '남', semester: '2026-2',
  preferredGenre: [], memo: '', isBoardMember: false, dormantSemester: '',
};

export function MembersScenario({ state }: { state: MembersScenarioState }) {
  const [members, setMembers] = useState(() => createMembersFixture(state));
  const [currentTab, setCurrentTab] = useState<'활동' | '휴면'>('활동');
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('전체');
  const [semesterFilter, setSemesterFilter] = useState('전체');
  const [genreFilter, setGenreFilter] = useState('전체');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(emptyMemberForm);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const semesters = useMemo(() => ['전체', ...new Set(members.map(member => member.semester))], [members]);
  const filteredMembers = useMemo(() => members.filter(member => {
    const matchesTab = currentTab === '휴면' ? member.status === '휴면' : member.status !== '휴면';
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ko-KR');
    const matchesSearch = !normalizedSearch || [member.name, member.nickname, member.studentId]
      .some(value => value.toLocaleLowerCase('ko-KR').includes(normalizedSearch));
    return matchesTab && matchesSearch
      && (genderFilter === '전체' || member.gender === genderFilter)
      && (semesterFilter === '전체' || member.semester === semesterFilter)
      && (genreFilter === '전체' || member.preferredGenre.includes(genreFilter));
  }), [currentTab, genderFilter, genreFilter, members, searchTerm, semesterFilter]);

  const resetForm = () => setFormData(emptyMemberForm);
  const updateSelected = (patch: Partial<Member>) => {
    setMembers(current => current.map(member => selectedDocs.has(member.id) ? { ...member, ...patch } : member));
    setSelectedDocs(new Set());
  };

  return <div className="space-y-6" data-scenario-page="members">
    <PageHeader
      title="동아리원 관리"
      subtitle="Database / Members Registry"
      icon={Users}
      stats={{ label: currentTab === '활동' ? '활동 인원' : '휴면 인원', value: filteredMembers.length }}
      actions={<button type="button" onClick={() => setIsAdding(true)} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-gold"><Plus size={16} />멤버 추가</button>}
    />
    {isAdding && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">Scenario Lab에서는 폼 상태만 미리 봅니다. 저장은 외부로 전송되지 않습니다.</div>}
    <MemberFilters
      currentTab={currentTab} setCurrentTab={setCurrentTab}
      searchTerm={searchTerm} setSearchTerm={setSearchTerm}
      genderFilter={genderFilter} setGenderFilter={setGenderFilter}
      semesterFilter={semesterFilter} setSemesterFilter={setSemesterFilter} semesters={semesters}
      genreFilter={genreFilter} setGenreFilter={setGenreFilter}
    />
    <MemberList
      filteredMembers={filteredMembers}
      editingId={editingId}
      onEdit={member => {
        setFormData(createMemberFormData(member));
        setEditingId(member.id);
        setIsAdding(false);
      }}
      setViewingMember={() => undefined}
      setItemToDelete={({ id }) => setMembers(current => current.filter(member => member.id !== id))}
      setFormData={setFormData} setIsAdding={setIsAdding} formData={formData}
      handleSubmit={(event: FormEvent) => { event.preventDefault(); setEditingId(null); }}
      resetForm={resetForm} isAdminModeActive
      selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs}
      handleBulkDormant={async dormantSemester => updateSelected({ status: '휴면', dormantSemester })}
      handleBulkDormantSemesterChange={async dormantSemester => updateSelected({ dormantSemester })}
      handleBulkRestoreActive={async () => updateSelected({ status: '활동', dormantSemester: '' })}
      currentTab={currentTab}
    />
  </div>;
}

export function InterviewScenario({ state }: { state: InterviewScenarioState }) {
  const fixture = useMemo(() => createInterviewFixture(state), [state]);
  const [applicants, setApplicants] = useState(fixture.applicants);
  const [draft, setDraft] = useState<AutoAssignmentResult | null>(null);

  const assign = async (applicantId: string, slotId: string, interviewerId: string) => {
    const interviewer = fixture.interviewers.find(item => item.interviewerId === interviewerId);
    setApplicants(current => current.map(applicant => applicant.id === applicantId ? {
      ...applicant,
      assignment: {
        slotId,
        startsAt: applicant.updatedAt,
        durationMinutes: fixture.round.assignmentSlotMinutes,
        interviewerId,
        interviewerName: interviewer?.displayName ?? '면접관',
        status: 'scheduled',
        locked: false,
        source: 'manual',
        confirmationRevision: (applicant.assignmentRevision ?? 0) + 1,
      },
      assignmentRevision: (applicant.assignmentRevision ?? 0) + 1,
      interviewStatus: 'scheduled',
    } : applicant));
    return true;
  };

  return <div className="space-y-6" data-scenario-page="interview">
    <PageHeader
      title="신입부원 면접"
      subtitle="Operations / Interview Scheduling"
      icon={CalendarClock}
      stats={{ label: '지원자', value: applicants.length }}
    />
    <InterviewSchedulePanel
      round={fixture.round}
      applicants={applicants}
      interviewers={fixture.interviewers}
      changeRequests={fixture.changeRequests}
      draft={draft}
      onDraftChange={setDraft}
      onRunAutoAssignment={() => {
        const waitingApplicants = applicants.filter(applicant => !applicant.assignment);
        const proposals = waitingApplicants.flatMap(applicant => {
          const interviewer = fixture.interviewers.find(item => item.availability.some(slotId => applicant.access?.availability.includes(slotId)));
          const slotId = interviewer?.availability.find(candidate => applicant.access?.availability.includes(candidate));
          return interviewer && slotId ? [{
            applicantId: applicant.id,
            applicantName: applicant.name,
            interviewerId: interviewer.interviewerId,
            interviewerName: interviewer.displayName,
            slotId,
            locked: false,
            preserved: false,
            protected: false,
            expectedAssignmentRevision: applicant.assignmentRevision ?? 0,
          }] : [];
        });
        setDraft({
          proposals,
          failures: [],
          totalApplicants: waitingApplicants.length,
          assignedCount: proposals.length,
          interviewerLoads: Object.fromEntries(proposals.map(proposal => [proposal.interviewerId, 1])),
        });
      }}
      onRunApplicantAutoAssignment={applicantId => {
        const applicant = applicants.find(item => item.id === applicantId);
        const interviewer = fixture.interviewers[0];
        const firstSlot = applicant?.access?.availability.find(slotId => interviewer?.availability.includes(slotId));
        if (applicant && interviewer && firstSlot) void assign(applicant.id, firstSlot, interviewer.interviewerId);
      }}
      onApplyDraft={async () => { setDraft(null); return true; }}
      onAssign={(applicant, slotId, interviewerId) => assign(applicant.id, slotId, interviewerId)}
      onClearAssignment={async applicantId => setApplicants(current => current.map(applicant => applicant.id === applicantId ? { ...applicant, assignment: null } : applicant))}
      onChangeAssignmentState={async (applicantId, patch: Partial<Pick<InterviewAssignment, 'locked' | 'status'>>) => {
        setApplicants(current => current.map(applicant => applicant.id === applicantId && applicant.assignment
          ? { ...applicant, assignment: { ...applicant.assignment, ...patch } }
          : applicant));
        return true;
      }}
      onResetSchedule={async applicantId => {
        setApplicants(current => current.map(applicant => applicant.id === applicantId
          ? { ...applicant, assignment: null, assignmentRevision: 0, interviewStatus: 'scheduled' }
          : applicant));
        return true;
      }}
    />
  </div>;
}

export function AttendanceScenario({ state }: { state: AttendanceScenarioState }) {
  const fixture = useMemo(() => createAttendanceFixture(state), [state]);
  const [members, setMembers] = useState(fixture.members);
  const [attendees, setAttendees] = useState(fixture.attendees);
  const [groups, setGroups] = useState<SessionGroup[]>(fixture.groups);
  const [sessionName, setSessionName] = useState('2026-08-27 정기 모임');
  const [sessionDate, setSessionDate] = useState('2026-08-27');
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const assignedIds = new Set(groups.flatMap(group => group.memberIds));
  const unassignedAttendees = attendees.filter(attendee => !assignedIds.has(attendee.id));
  const getMemberFromInfo = (name?: string, studentIdPrefix?: string) => members.find(member =>
    member.name === name && (!studentIdPrefix || member.studentId.startsWith(studentIdPrefix)));
  const memberAttendanceCount = Object.fromEntries(members.map((member, index) => [member.id, (index * 3) % 11]));
  const dragKey = 'application/x-avalon-scenario-attendee';
  const handleDragStart = (event: DragEvent, attendeeId: string, source: string) => {
    event.dataTransfer.setData(dragKey, JSON.stringify({ attendeeId, source }));
  };
  const readDrag = (event: DragEvent) => {
    try { return JSON.parse(event.dataTransfer.getData(dragKey)) as { attendeeId: string; source: string }; }
    catch { return null; }
  };
  const removeFromGroups = (attendeeId: string) => setGroups(current => current.map(group => ({ ...group, memberIds: group.memberIds.filter(id => id !== attendeeId) })));

  return <div className="space-y-6" data-scenario-page="attendance">
    <PageHeader
      title="일일 조 편성"
      subtitle="Operations / Team Formation"
      icon={ClipboardList}
      actions={<button type="button" onClick={() => setIsAutoMode(current => !current)} className={`rounded-xl px-4 py-2.5 text-xs font-bold shadow ${isAutoMode ? 'bg-orange-100 text-orange-700' : 'bg-white text-slate-600'}`}>{isAutoMode ? '자동 편성 모드 종료' : '자동 조편성'}</button>}
    />
    <div className="grid min-h-[500px] grid-cols-1 gap-6 md:grid-cols-4">
      <UnassignedPool
        unassignedAttendees={unassignedAttendees}
        getMemberFromInfo={getMemberFromInfo}
        memberAttendanceCount={memberAttendanceCount}
        onManualAddOpen={() => undefined}
        onDragStart={handleDragStart}
        onDragOver={event => event.preventDefault()}
        onDropToUnassigned={event => { event.preventDefault(); const data = readDrag(event); if (data) removeFromGroups(data.attendeeId); }}
        onQuickAddMember={attendee => setMembers(current => [...current, { ...createMembersFixture('default')[0]!, id: `local-${attendee.id}`, name: attendee.name, studentId: `${attendee.studentIdPrefix ?? '26'}00000` }])}
        onDeleteAttendee={(attendee: Attendee) => { setAttendees(current => current.filter(item => item.id !== attendee.id)); removeFromGroups(attendee.id); }}
      />
      <GroupsCanvas
        isAdminModeActive sessionName={sessionName} setSessionName={setSessionName}
        sessionDate={sessionDate} setSessionDate={setSessionDate}
        groups={groups} setGroups={setGroups} isAutoMode={isAutoMode}
        onAutoAssign={() => setGroups(current => current.map((group, index) => ({ ...group, memberIds: [...group.memberIds, ...unassignedAttendees.filter((_, attendeeIndex) => attendeeIndex % Math.max(current.length, 1) === index).map(attendee => attendee.id)] })))}
        onCostModalOpen={() => undefined} onExportSimulation={() => undefined} onMoveToRecord={() => undefined}
        editingGroupId={editingGroupId} setEditingGroupId={setEditingGroupId}
        editingGroupName={editingGroupName} setEditingGroupName={setEditingGroupName}
        onUpdateTargetSize={(groupId, size) => setGroups(current => current.map(group => group.id === groupId ? { ...group, targetSize: size } : group))}
        onCreateGroup={() => setGroups(current => [...current, { id: `local-group-${current.length + 1}`, name: `${current.length + 1}조`, memberIds: [], gameIds: [] }])}
        onDragOver={event => event.preventDefault()}
        onDropToGroup={(event, groupId) => { event.preventDefault(); const data = readDrag(event); if (!data) return; setGroups(current => current.map(group => ({ ...group, memberIds: group.id === groupId ? [...new Set([...group.memberIds.filter(id => id !== data.attendeeId), data.attendeeId])] : group.memberIds.filter(id => id !== data.attendeeId) }))); }}
        onDragStart={handleDragStart}
        removeFromGroup={(attendeeId, groupId) => setGroups(current => current.map(group => group.id === groupId ? { ...group, memberIds: group.memberIds.filter(id => id !== attendeeId) } : group))}
        attendees={attendees} getMemberFromInfo={getMemberFromInfo} memberAttendanceCount={memberAttendanceCount}
        activeRequestId={activeRequestId} setActiveRequestId={setActiveRequestId}
        getReunionWarnings={() => []}
        calculateGroupAverageStudentId={ids => ids.length ? 23 : '-'}
        calculateGroupAverageAttendance={ids => ids.length ? 4.5 : 0}
      />
    </div>
  </div>;
}
