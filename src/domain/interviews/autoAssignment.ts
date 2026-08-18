import { availabilityToAssignmentCandidates, parseSlotId } from './scheduling';

export type AutoAssignmentMode = 'all' | 'unassigned' | 'applicant';

export interface AutoAssignmentExisting {
  slotId: string;
  interviewerId: string;
  interviewerName: string;
  locked: boolean;
  source: 'manual' | 'automatic';
  status: 'scheduled' | 'confirmed' | 'change_requested' | 'completed' | 'no_show' | 'cancelled' | 'needs_reschedule';
}

export interface AutoAssignmentApplicant {
  id: string;
  name: string;
  availability: string[];
  lifecycle?: 'active' | 'archived';
  existingAssignment?: AutoAssignmentExisting | null;
}

export interface AutoAssignmentInterviewer {
  id: string;
  name: string;
  availability: string[];
  active?: boolean;
}

export interface AutoAssignmentInput {
  applicants: AutoAssignmentApplicant[];
  interviewers: AutoAssignmentInterviewer[];
  availabilitySlotMinutes: number;
  assignmentSlotMinutes: number;
  mode: AutoAssignmentMode;
  applicantId?: string;
}

export interface AutoAssignmentProposal {
  applicantId: string;
  applicantName: string;
  interviewerId: string;
  interviewerName: string;
  slotId: string;
  locked: boolean;
  preserved: boolean;
}

export type AutoAssignmentFailureReason =
  | 'no_availability'
  | 'no_interviewer_overlap'
  | 'all_candidates_occupied'
  | 'excluded_state';

export interface AutoAssignmentFailure {
  applicantId: string;
  applicantName: string;
  reason: AutoAssignmentFailureReason;
}

export interface AutoAssignmentResult {
  proposals: AutoAssignmentProposal[];
  failures: AutoAssignmentFailure[];
  totalApplicants: number;
  assignedCount: number;
  interviewerLoads: Record<string, number>;
}

interface Edge { to: number; reverse: number; capacity: number; cost: number; }
interface Candidate { resourceKey: string; slotId: string; interviewerId: string; interviewerName: string; }

function addEdge(graph: Edge[][], from: number, to: number, capacity: number, cost: number) {
  graph[from]?.push({ to, reverse: graph[to]?.length ?? 0, capacity, cost });
  graph[to]?.push({ to: from, reverse: (graph[from]?.length ?? 1) - 1, capacity: 0, cost: -cost });
}

function minCostMaxFlow(graph: Edge[][], source: number, sink: number): void {
  while (true) {
    const distance = Array(graph.length).fill(Number.POSITIVE_INFINITY) as number[];
    const previousNode = Array(graph.length).fill(-1) as number[];
    const previousEdge = Array(graph.length).fill(-1) as number[];
    const inQueue = Array(graph.length).fill(false) as boolean[];
    const queue: number[] = [source];
    distance[source] = 0;
    inQueue[source] = true;
    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head];
      if (node === undefined) continue;
      inQueue[node] = false;
      const nodeDistance = distance[node] ?? Number.POSITIVE_INFINITY;
      graph[node]?.forEach((edge, edgeIndex) => {
        if (edge.capacity <= 0 || nodeDistance + edge.cost >= (distance[edge.to] ?? Number.POSITIVE_INFINITY)) return;
        distance[edge.to] = nodeDistance + edge.cost;
        previousNode[edge.to] = node;
        previousEdge[edge.to] = edgeIndex;
        if (!inQueue[edge.to]) { queue.push(edge.to); inQueue[edge.to] = true; }
      });
    }
    if ((previousNode[sink] ?? -1) < 0) return;
    for (let node = sink; node !== source;) {
      const from = previousNode[node] ?? -1;
      const edgeIndex = previousEdge[node] ?? -1;
      if (from < 0 || edgeIndex < 0) throw new Error('Invalid matching path.');
      const edge = graph[from]?.[edgeIndex];
      if (!edge) throw new Error('Invalid matching path.');
      edge.capacity -= 1;
      const reverse = graph[node]?.[edge.reverse];
      if (reverse) reverse.capacity += 1;
      node = from;
    }
  }
}

function shouldFix(applicant: AutoAssignmentApplicant, input: AutoAssignmentInput): boolean {
  const assignment = applicant.existingAssignment;
  if (!assignment) return false;
  if (assignment.status === 'no_show' || assignment.status === 'cancelled' || assignment.status === 'needs_reschedule') return false;
  if (assignment.locked || assignment.status === 'completed') return true;
  if (input.mode === 'unassigned') return true;
  return input.mode === 'applicant' && applicant.id !== input.applicantId;
}

function slotOrdinal(slotId: string): number {
  const parsed = parseSlotId(slotId);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  const [hour = '0', minute = '0'] = parsed.time.split(':');
  return Date.parse(`${parsed.date}T00:00:00Z`) / 60_000 + Number(hour) * 60 + Number(minute);
}

export function generateAutoAssignment(input: AutoAssignmentInput): AutoAssignmentResult {
  const activeInterviewers = input.interviewers.filter(item => item.active !== false);
  const interviewerCandidates = new Map(activeInterviewers.map(interviewer => [
    interviewer.id,
    new Set(availabilityToAssignmentCandidates(interviewer.availability, input.availabilitySlotMinutes, input.assignmentSlotMinutes)),
  ]));
  const fixed = input.applicants.filter(applicant => shouldFix(applicant, input) && applicant.existingAssignment);
  const reservedResources = new Set(fixed.map(applicant => {
    const assignment = applicant.existingAssignment!;
    return `${assignment.interviewerId}|${assignment.slotId}`;
  }));
  const fixedLoads = new Map<string, number>();
  const fixedSlots = new Map<string, number[]>();
  fixed.forEach(applicant => {
    const interviewerId = applicant.existingAssignment!.interviewerId;
    fixedLoads.set(interviewerId, (fixedLoads.get(interviewerId) ?? 0) + 1);
    const slots = fixedSlots.get(interviewerId) ?? [];
    slots.push(slotOrdinal(applicant.existingAssignment!.slotId));
    fixedSlots.set(interviewerId, slots);
  });
  const proposals: AutoAssignmentProposal[] = fixed.map(applicant => ({
    applicantId: applicant.id,
    applicantName: applicant.name,
    interviewerId: applicant.existingAssignment!.interviewerId,
    interviewerName: applicant.existingAssignment!.interviewerName,
    slotId: applicant.existingAssignment!.slotId,
    locked: applicant.existingAssignment!.locked,
    preserved: true,
  }));

  const eligible = input.applicants.filter(applicant => {
    if (applicant.lifecycle === 'archived' || shouldFix(applicant, input)) return false;
    if (input.mode === 'applicant' && applicant.id !== input.applicantId) return false;
    const status = applicant.existingAssignment?.status;
    return status !== 'completed' && status !== 'no_show' && status !== 'cancelled';
  });
  const candidatesByApplicant = new Map<string, Candidate[]>();
  const hasInterviewerOverlap = new Map<string, boolean>();
  eligible.forEach(applicant => {
    const applicantSlots = availabilityToAssignmentCandidates(applicant.availability, input.availabilitySlotMinutes, input.assignmentSlotMinutes);
    const candidates: Candidate[] = [];
    let hasOverlap = false;
    activeInterviewers.forEach(interviewer => {
      const interviewerSlots = interviewerCandidates.get(interviewer.id) ?? new Set<string>();
      applicantSlots.forEach(slotId => {
        const resourceKey = `${interviewer.id}|${slotId}`;
        if (interviewerSlots.has(slotId)) hasOverlap = true;
        if (interviewerSlots.has(slotId) && !reservedResources.has(resourceKey)) {
          candidates.push({ resourceKey, slotId, interviewerId: interviewer.id, interviewerName: interviewer.name });
        }
      });
    });
    candidates.sort((left, right) => left.resourceKey.localeCompare(right.resourceKey));
    candidatesByApplicant.set(applicant.id, candidates);
    hasInterviewerOverlap.set(applicant.id, hasOverlap);
  });

  const resources = [...new Map([...candidatesByApplicant.values()].flat().map(candidate => [candidate.resourceKey, candidate])).values()];
  const interviewerIds = [...new Set(resources.map(resource => resource.interviewerId))].sort();
  const source = 0;
  const applicantOffset = 1;
  const resourceOffset = applicantOffset + eligible.length;
  const interviewerOffset = resourceOffset + resources.length;
  const sink = interviewerOffset + interviewerIds.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const resourceIndex = new Map(resources.map((resource, index) => [resource.resourceKey, resourceOffset + index]));
  const interviewerIndex = new Map(interviewerIds.map((id, index) => [id, interviewerOffset + index]));

  eligible.forEach((applicant, index) => {
    const applicantNode = applicantOffset + index;
    const candidates = candidatesByApplicant.get(applicant.id) ?? [];
    addEdge(graph, source, applicantNode, 1, candidates.length * 10_000);
    candidates.forEach((candidate, candidateIndex) => {
      const current = applicant.existingAssignment;
      const preserved = current?.slotId === candidate.slotId && current.interviewerId === candidate.interviewerId;
      const preservationCost = preserved ? -5_000 : current ? 2_000 : 0;
      const anchors = fixedSlots.get(candidate.interviewerId) ?? [];
      const compactnessCost = anchors.length > 0
        ? Math.min(...anchors.map(anchor => Math.abs(slotOrdinal(candidate.slotId) - anchor))) * 2
        : candidateIndex;
      addEdge(graph, applicantNode, resourceIndex.get(candidate.resourceKey)!, 1, preservationCost + compactnessCost + candidateIndex);
    });
  });
  resources.forEach((resource, index) => {
    addEdge(graph, resourceOffset + index, interviewerIndex.get(resource.interviewerId)!, 1, 0);
  });
  interviewerIds.forEach(id => {
    const interviewerNode = interviewerIndex.get(id)!;
    const capacity = resources.filter(resource => resource.interviewerId === id).length;
    const baseLoad = fixedLoads.get(id) ?? 0;
    for (let unit = 0; unit < capacity; unit += 1) {
      addEdge(graph, interviewerNode, sink, 1, (baseLoad + unit) * (baseLoad + unit) * 100);
    }
  });
  minCostMaxFlow(graph, source, sink);

  eligible.forEach((applicant, index) => {
    const applicantNode = applicantOffset + index;
    const chosenEdge = graph[applicantNode]?.find(edge => (
      edge.to >= resourceOffset && edge.to < interviewerOffset && edge.capacity === 0
    ));
    if (!chosenEdge) return;
    const candidate = resources[chosenEdge.to - resourceOffset];
    if (!candidate) return;
    const current = applicant.existingAssignment;
    proposals.push({
      applicantId: applicant.id,
      applicantName: applicant.name,
      interviewerId: candidate.interviewerId,
      interviewerName: candidate.interviewerName,
      slotId: candidate.slotId,
      locked: false,
      preserved: current?.slotId === candidate.slotId && current.interviewerId === candidate.interviewerId,
    });
  });

  const proposalIds = new Set(proposals.map(proposal => proposal.applicantId));
  const failures: AutoAssignmentFailure[] = input.applicants.flatMap<AutoAssignmentFailure>(applicant => {
    if (proposalIds.has(applicant.id)) return [];
    if (input.mode === 'applicant' && applicant.id !== input.applicantId) return [];
    if (applicant.lifecycle === 'archived' || ['completed', 'no_show', 'cancelled'].includes(applicant.existingAssignment?.status ?? '')) {
      return [{ applicantId: applicant.id, applicantName: applicant.name, reason: 'excluded_state' as const }];
    }
    if (applicant.availability.length === 0) return [{ applicantId: applicant.id, applicantName: applicant.name, reason: 'no_availability' as const }];
    return [{
      applicantId: applicant.id,
      applicantName: applicant.name,
      reason: !hasInterviewerOverlap.get(applicant.id) ? 'no_interviewer_overlap' as const : 'all_candidates_occupied' as const,
    }];
  });
  const interviewerLoads: Record<string, number> = {};
  proposals.forEach(proposal => { interviewerLoads[proposal.interviewerId] = (interviewerLoads[proposal.interviewerId] ?? 0) + 1; });
  return {
    proposals: proposals.sort((left, right) => left.slotId.localeCompare(right.slotId) || left.interviewerName.localeCompare(right.interviewerName)),
    failures,
    totalApplicants: input.applicants.filter(item => item.lifecycle !== 'archived').length,
    assignedCount: proposals.length,
    interviewerLoads,
  };
}
