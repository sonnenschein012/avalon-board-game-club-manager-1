import { availabilityToAssignmentCandidates } from './scheduling';

/** `applicant` is the V3 path; bulk modes remain for the existing V2 screen. */
export type AutoAssignmentMode = 'all' | 'unassigned' | 'applicant';

export interface AutoAssignmentExisting {
  slotId: string;
  interviewerId: string;
  interviewerName: string;
  locked: boolean;
  source: 'manual' | 'automatic';
  status: 'scheduled' | 'confirmed' | 'change_requested' | 'completed' | 'no_show' | 'cancelled' | 'needs_reschedule';
  /** True only when an already-sent confirmation describes this assignment revision. */
  confirmationCurrent?: boolean;
}

export interface AutoAssignmentApplicant {
  id: string;
  name: string;
  availability: string[];
  lifecycle?: 'active' | 'archived' | 'withdrawn';
  /** Supports callers which keep application status separately from lifecycle. */
  withdrawn?: boolean;
  interviewStatus?: 'scheduled' | 'completed' | 'action_needed';
  assignmentRevision?: number;
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
  /** True when the current assignment is locked or its confirmation is current. */
  protected: boolean;
  expectedAssignmentRevision: number;
}

export type AutoAssignmentFailureReason = 'no_availability' | 'no_interviewer_overlap' | 'all_candidates_occupied' | 'excluded_state';
export interface AutoAssignmentFailure { applicantId: string; applicantName: string; reason: AutoAssignmentFailureReason; }
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

function resourceKey(assignment: Pick<AutoAssignmentExisting, 'interviewerId' | 'slotId'>): string {
  return `${assignment.interviewerId}|${assignment.slotId}`;
}

function isExcluded(applicant: AutoAssignmentApplicant): boolean {
  if (applicant.lifecycle === 'archived' || applicant.lifecycle === 'withdrawn' || applicant.withdrawn) return true;
  if (applicant.interviewStatus === 'completed' || applicant.interviewStatus === 'action_needed') return true;
  const status = applicant.existingAssignment?.status;
  return status === 'completed' || status === 'no_show' || status === 'cancelled'
    || status === 'change_requested' || status === 'needs_reschedule';
}

function isCurrentProtected(assignment: AutoAssignmentExisting | null | undefined): boolean {
  return Boolean(assignment && (assignment.locked || assignment.confirmationCurrent === true));
}

function keepsResourceReserved(applicant: AutoAssignmentApplicant): boolean {
  const status = applicant.existingAssignment?.status;
  return Boolean(applicant.existingAssignment && status && (
    status === 'completed'
    || applicant.interviewStatus === 'completed'
    || applicant.interviewStatus === 'action_needed'
    || status === 'no_show'
    || status === 'cancelled'
    || status === 'change_requested'
    || status === 'needs_reschedule'
    || applicant.lifecycle === 'archived'
  ));
}

function proposalFromExisting(applicant: AutoAssignmentApplicant): AutoAssignmentProposal | null {
  const assignment = applicant.existingAssignment;
  if (!assignment) return null;
  return {
    applicantId: applicant.id, applicantName: applicant.name,
    interviewerId: assignment.interviewerId, interviewerName: assignment.interviewerName,
    slotId: assignment.slotId, locked: assignment.locked, preserved: true,
    protected: isCurrentProtected(assignment),
    expectedAssignmentRevision: applicant.assignmentRevision ?? 0,
  };
}

function candidateList(
  applicant: AutoAssignmentApplicant,
  interviewers: readonly AutoAssignmentInterviewer[],
  interviewerSlots: ReadonlyMap<string, Set<string>>,
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
): Candidate[] {
  const applicantSlots = availabilityToAssignmentCandidates(applicant.availability, availabilitySlotMinutes, assignmentSlotMinutes);
  const candidates = new Map<string, Candidate>();
  for (const interviewer of interviewers) {
    const available = interviewerSlots.get(interviewer.id) ?? new Set<string>();
    for (const slotId of applicantSlots) {
      if (!available.has(slotId)) continue;
      const candidate = { resourceKey: `${interviewer.id}|${slotId}`, slotId, interviewerId: interviewer.id, interviewerName: interviewer.name };
      candidates.set(candidate.resourceKey, candidate);
    }
  }
  // Preserve a still-active tentative booking even if availability was edited
  // after it was made; a rearrangement must not silently drop that person.
  const current = applicant.existingAssignment;
  if (current && interviewers.some(item => item.id === current.interviewerId)) {
    candidates.set(resourceKey(current), {
      resourceKey: resourceKey(current), slotId: current.slotId,
      interviewerId: current.interviewerId, interviewerName: current.interviewerName,
    });
  }
  return [...candidates.values()].sort((left, right) => left.resourceKey.localeCompare(right.resourceKey));
}

function hasAnyInterviewerOverlap(
  applicant: AutoAssignmentApplicant,
  interviewerSlots: ReadonlyMap<string, Set<string>>,
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
): boolean {
  if (applicant.availability.length === 0) return false;
  const slots = availabilityToAssignmentCandidates(applicant.availability, availabilitySlotMinutes, assignmentSlotMinutes);
  return [...interviewerSlots.values()].some(interviewer => slots.some(slot => interviewer.has(slot)));
}

/**
 * Matches as many applicants as possible, then minimizes interviewer utilization
 * variance before considering tentative-assignment movement.  Convex load costs
 * make the next assignment increasingly expensive as an interviewer's effective
 * capacity is consumed.
 */
function match(
  applicants: readonly AutoAssignmentApplicant[],
  candidatesByApplicant: ReadonlyMap<string, Candidate[]>,
  baselineLoads: ReadonlyMap<string, number> = new Map(),
): Map<string, Candidate> {
  const resources = [...new Map([...candidatesByApplicant.values()].flat().map(candidate => [candidate.resourceKey, candidate])).values()]
    .sort((left, right) => left.resourceKey.localeCompare(right.resourceKey));
  const source = 0;
  const applicantOffset = 1;
  const resourceOffset = applicantOffset + applicants.length;
  const interviewerIds = [...new Set(resources.map(resource => resource.interviewerId))].sort();
  const interviewerOffset = resourceOffset + resources.length;
  const sink = interviewerOffset + interviewerIds.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const resourceIndex = new Map(resources.map((resource, index) => [resource.resourceKey, resourceOffset + index]));
  const interviewerIndex = new Map(interviewerIds.map((id, index) => [id, interviewerOffset + index]));

  applicants.forEach((applicant, applicantIndex) => {
    const node = applicantOffset + applicantIndex;
    addEdge(graph, source, node, 1, 0);
    const currentKey = applicant.existingAssignment ? resourceKey(applicant.existingAssignment) : null;
    (candidatesByApplicant.get(applicant.id) ?? []).forEach((candidate, candidateIndex) => {
      // Load balance has higher priority than preserving a tentative assignment.
      const moveCost = currentKey && currentKey !== candidate.resourceKey ? 1_000 : 0;
      addEdge(graph, node, resourceIndex.get(candidate.resourceKey)!, 1, moveCost + candidateIndex);
    });
  });
  resources.forEach((resource, index) => {
    addEdge(graph, resourceOffset + index, interviewerIndex.get(resource.interviewerId)!, 1, 0);
  });
  interviewerIds.forEach(interviewerId => {
    const node = interviewerIndex.get(interviewerId)!;
    const capacity = Math.max(1, resources.filter(resource => resource.interviewerId === interviewerId).length);
    const baseline = baselineLoads.get(interviewerId) ?? 0;
    for (let loadIndex = 1; loadIndex <= capacity; loadIndex += 1) {
      // Marginal cost of squared utilization: ((b+k)/capacity)^2.
      const marginal = Math.round((((baseline + loadIndex) ** 2 - (baseline + loadIndex - 1) ** 2) * 1_000_000) / (capacity ** 2));
      addEdge(graph, node, sink, 1, marginal);
    }
  });
  minCostMaxFlow(graph, source, sink);

  const assignments = new Map<string, Candidate>();
  applicants.forEach((applicant, applicantIndex) => {
    const chosen = graph[applicantOffset + applicantIndex]?.find(edge => edge.to >= resourceOffset && edge.to < sink && edge.capacity === 0);
    const candidate = chosen ? resources[chosen.to - resourceOffset] : null;
    if (candidate) assignments.set(applicant.id, candidate);
  });
  return assignments;
}

function failureFor(applicant: AutoAssignmentApplicant, hasOverlap: boolean): AutoAssignmentFailure {
  if (isExcluded(applicant)) return { applicantId: applicant.id, applicantName: applicant.name, reason: 'excluded_state' };
  if (applicant.availability.length === 0) return { applicantId: applicant.id, applicantName: applicant.name, reason: 'no_availability' };
  return { applicantId: applicant.id, applicantName: applicant.name, reason: hasOverlap ? 'all_candidates_occupied' : 'no_interviewer_overlap' };
}

function resultFromProposals(proposals: AutoAssignmentProposal[], failures: AutoAssignmentFailure[], applicants: readonly AutoAssignmentApplicant[]): AutoAssignmentResult {
  const interviewerLoads: Record<string, number> = {};
  proposals.forEach(proposal => { interviewerLoads[proposal.interviewerId] = (interviewerLoads[proposal.interviewerId] ?? 0) + 1; });
  return {
    proposals: proposals.sort((left, right) => left.slotId.localeCompare(right.slotId) || left.interviewerName.localeCompare(right.interviewerName) || left.applicantName.localeCompare(right.applicantName)),
    failures,
    totalApplicants: applicants.filter(applicant => !isExcluded(applicant)).length,
    assignedCount: proposals.length,
    interviewerLoads,
  };
}

function generateForApplicant(input: AutoAssignmentInput, activeInterviewers: AutoAssignmentInterviewer[], interviewerSlots: Map<string, Set<string>>): AutoAssignmentResult {
  const target = input.applicants.find(applicant => applicant.id === input.applicantId);
  if (!target) return resultFromProposals([], [], input.applicants);
  const existingProposals = input.applicants.filter(applicant => !isExcluded(applicant)).flatMap(applicant => proposalFromExisting(applicant) ?? []);
  const overlap = hasAnyInterviewerOverlap(target, interviewerSlots, input.availabilitySlotMinutes, input.assignmentSlotMinutes);
  if (isExcluded(target)) return resultFromProposals(existingProposals, [failureFor(target, overlap)], input.applicants);

  const targetCandidates = candidateList(target, activeInterviewers, interviewerSlots, input.availabilitySlotMinutes, input.assignmentSlotMinutes);
  const others = input.applicants.filter(applicant => applicant.id !== target.id && !isExcluded(applicant) && applicant.existingAssignment);
  const excludedReservations = input.applicants.filter(applicant => applicant.id !== target.id && isExcluded(applicant) && keepsResourceReserved(applicant));
  const occupied = new Set([...others, ...excludedReservations].map(applicant => resourceKey(applicant.existingAssignment!)));
  const ownKey = target.existingAssignment ? resourceKey(target.existingAssignment) : null;

  // Stage 1: assign an actually empty resource and leave everyone else alone.
  const stageOne = targetCandidates.find(candidate => candidate.resourceKey === ownKey && !occupied.has(candidate.resourceKey))
    ?? targetCandidates.find(candidate => !occupied.has(candidate.resourceKey));
  if (stageOne) {
    const proposals = existingProposals.filter(proposal => proposal.applicantId !== target.id);
    proposals.push({
      applicantId: target.id, applicantName: target.name,
      interviewerId: stageOne.interviewerId, interviewerName: stageOne.interviewerName,
      slotId: stageOne.slotId, locked: false, preserved: stageOne.resourceKey === ownKey,
      protected: stageOne.resourceKey === ownKey && isCurrentProtected(target.existingAssignment),
      expectedAssignmentRevision: target.assignmentRevision ?? 0,
    });
    return resultFromProposals(proposals, [], input.applicants);
  }

  // Stage 2: only unconfirmed and unlocked appointments may move. The target
  // is accepted only if every person in the limited rearrangement keeps a slot.
  if (isCurrentProtected(target.existingAssignment)) {
    return resultFromProposals(existingProposals, [failureFor(target, overlap)], input.applicants);
  }
  const fixed = others.filter(applicant => {
    const assignment = applicant.existingAssignment!;
    return isCurrentProtected(assignment) || !activeInterviewers.some(interviewer => interviewer.id === assignment.interviewerId);
  });
  const movable = others.filter(applicant => !fixed.includes(applicant));
  const reserved = new Set([...fixed, ...excludedReservations].map(applicant => resourceKey(applicant.existingAssignment!)));
  const participants = [target, ...movable].sort((left, right) => left.id.localeCompare(right.id));
  const candidatesByApplicant = new Map<string, Candidate[]>();
  participants.forEach(applicant => {
    candidatesByApplicant.set(applicant.id, candidateList(
      applicant, activeInterviewers, interviewerSlots, input.availabilitySlotMinutes, input.assignmentSlotMinutes,
    ).filter(candidate => !reserved.has(candidate.resourceKey)));
  });
  const fixedLoads = new Map<string, number>();
  [...fixed, ...excludedReservations].forEach(applicant => {
    const interviewerId = applicant.existingAssignment?.interviewerId;
    if (interviewerId) fixedLoads.set(interviewerId, (fixedLoads.get(interviewerId) ?? 0) + 1);
  });
  const assignments = match(participants, candidatesByApplicant, fixedLoads);
  if (!assignments.has(target.id) || assignments.size !== participants.length) {
    return resultFromProposals(existingProposals, [failureFor(target, overlap)], input.applicants);
  }

  const proposals = existingProposals.filter(proposal => !assignments.has(proposal.applicantId));
  participants.forEach(applicant => {
    const candidate = assignments.get(applicant.id)!;
    const currentKey = applicant.existingAssignment ? resourceKey(applicant.existingAssignment) : null;
    proposals.push({
      applicantId: applicant.id, applicantName: applicant.name,
      interviewerId: candidate.interviewerId, interviewerName: candidate.interviewerName,
      slotId: candidate.slotId, locked: false, preserved: candidate.resourceKey === currentKey,
      protected: false,
      expectedAssignmentRevision: applicant.assignmentRevision ?? 0,
    });
  });
  return resultFromProposals(proposals, [], input.applicants);
}

function generateBulk(input: AutoAssignmentInput, activeInterviewers: AutoAssignmentInterviewer[], interviewerSlots: Map<string, Set<string>>): AutoAssignmentResult {
  const fixed = input.applicants.filter(applicant => {
    if (isExcluded(applicant) || !applicant.existingAssignment) return false;
    return input.mode === 'unassigned' || isCurrentProtected(applicant.existingAssignment);
  });
  const excludedReservations = input.applicants.filter(applicant => isExcluded(applicant) && keepsResourceReserved(applicant));
  const reserved = new Set([...fixed, ...excludedReservations].map(applicant => resourceKey(applicant.existingAssignment!)));
  const candidates = input.applicants.filter(applicant => !isExcluded(applicant) && !fixed.includes(applicant));
  const candidatesByApplicant = new Map<string, Candidate[]>();
  const overlaps = new Map<string, boolean>();
  candidates.forEach(applicant => {
    candidatesByApplicant.set(applicant.id, candidateList(
      applicant, activeInterviewers, interviewerSlots, input.availabilitySlotMinutes, input.assignmentSlotMinutes,
    ).filter(candidate => !reserved.has(candidate.resourceKey)));
    overlaps.set(applicant.id, hasAnyInterviewerOverlap(applicant, interviewerSlots, input.availabilitySlotMinutes, input.assignmentSlotMinutes));
  });
  const fixedLoads = new Map<string, number>();
  [...fixed, ...excludedReservations].forEach(applicant => {
    const interviewerId = applicant.existingAssignment?.interviewerId;
    if (interviewerId) fixedLoads.set(interviewerId, (fixedLoads.get(interviewerId) ?? 0) + 1);
  });
  const assignments = match(candidates, candidatesByApplicant, fixedLoads);
  const proposals = fixed.flatMap(applicant => proposalFromExisting(applicant) ?? []);
  candidates.forEach(applicant => {
    const candidate = assignments.get(applicant.id);
    if (!candidate) return;
    const currentKey = applicant.existingAssignment ? resourceKey(applicant.existingAssignment) : null;
    proposals.push({
      applicantId: applicant.id, applicantName: applicant.name,
      interviewerId: candidate.interviewerId, interviewerName: candidate.interviewerName,
      slotId: candidate.slotId, locked: false, preserved: candidate.resourceKey === currentKey,
      protected: false,
      expectedAssignmentRevision: applicant.assignmentRevision ?? 0,
    });
  });
  const proposalIds = new Set(proposals.map(proposal => proposal.applicantId));
  const failures = input.applicants.flatMap(applicant => proposalIds.has(applicant.id) ? [] : [failureFor(applicant, overlaps.get(applicant.id) ?? false)]);
  return resultFromProposals(proposals, failures, input.applicants);
}

export function generateAutoAssignment(input: AutoAssignmentInput): AutoAssignmentResult {
  const activeInterviewers = input.interviewers.filter(interviewer => interviewer.active !== false);
  const interviewerSlots = new Map(activeInterviewers.map(interviewer => [
    interviewer.id,
    new Set(availabilityToAssignmentCandidates(interviewer.availability, input.availabilitySlotMinutes, input.assignmentSlotMinutes)),
  ]));
  return input.mode === 'applicant'
    ? generateForApplicant(input, activeInterviewers, interviewerSlots)
    : generateBulk(input, activeInterviewers, interviewerSlots);
}
