import { Attendee, Member, SessionGroup } from '../../types';
import { CostCalculationContext, getGroupCostDets } from './groupCostFunction';

export interface AutoAssignResult {
  updatedGroups: SessionGroup[];
  costLog?: { pureCost: number; reward: number }[];
  actualCost?: number;
}

export function simulateAutoAssign(
  availableAttendees: (Attendee & { member: Member })[],
  initialGroups: SessionGroup[],
  getMember: (attendeeId: string) => Member | undefined,
  ctx: CostCalculationContext,
  withHistory: boolean = false
): AutoAssignResult {
  const capacities = initialGroups.map(g => ({
    id: g.id,
    target: g.targetSize || g.memberIds.length
  }));

  const workingGroups = initialGroups.map(g => ({ id: g.id, memberIds: [...g.memberIds] }));
  const toAssign = [...availableAttendees].sort((a, b) => {
    const aYr = parseInt(a.member.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x => x) || '25');
    const bYr = parseInt(b.member.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x => x) || '25');
    return aYr - bYr;
  });

  let gIdx = 0;
  toAssign.forEach(ta => {
    let assigned = false;
    for (let i = 0; i < workingGroups.length; i++) {
      const wg = workingGroups[(gIdx + i) % workingGroups.length];
      if (!wg) continue;
      const cap = capacities.find(c => c.id === wg.id);
      if (cap && wg.memberIds.length < cap.target) {
        wg.memberIds.push(ta.id);
        assigned = true;
        gIdx = (gIdx + i) % workingGroups.length;
        break;
      }
    }
    if (!assigned && workingGroups.length > 0) {
      const fw = workingGroups[gIdx % workingGroups.length];
      if (fw) {
        fw.memberIds.push(ta.id);
      }
      gIdx++;
    }
  });

  const getCostDets = (gMemberIds: string[]) => {
    const gMems = gMemberIds.map(id => getMember(id)).filter(Boolean) as Member[];
    return getGroupCostDets(gMems, ctx);
  };

  const unassignedIdsSet = new Set(availableAttendees.map(a => a.id));
  const MAX_STEPS = 5000;
  const simulationHistory: { pureCost: number; reward: number }[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const idx1 = Math.floor(Math.random() * workingGroups.length);
    const idx2 = Math.floor(Math.random() * workingGroups.length);
    if (idx1 === idx2) continue;

    const g1 = workingGroups[idx1];
    const g2 = workingGroups[idx2];
    if (!g1 || !g2 || g1.memberIds.length === 0 || g2.memberIds.length === 0) continue;

    const movable1 = g1.memberIds.filter(id => unassignedIdsSet.has(id));
    const movable2 = g2.memberIds.filter(id => unassignedIdsSet.has(id));
    if (movable1.length === 0 || movable2.length === 0) continue;

    const m1 = movable1[Math.floor(Math.random() * movable1.length)];
    const m2 = movable2[Math.floor(Math.random() * movable2.length)];
    if (!m1 || !m2) continue;

    const newG1Ids = [...g1.memberIds.filter(id => id !== m1), m2];
    const newG2Ids = [...g2.memberIds.filter(id => id !== m2), m1];

    if (withHistory) {
      let virtualTotalReward = 0;
      let virtualTotalPureCost = 0;
      for (let i = 0; i < workingGroups.length; i++) {
        if (i === idx1) {
          const d = getCostDets(newG1Ids);
          virtualTotalPureCost += d.costWithoutReward;
          virtualTotalReward += d.requestReward;
        } else if (i === idx2) {
          const d = getCostDets(newG2Ids);
          virtualTotalPureCost += d.costWithoutReward;
          virtualTotalReward += d.requestReward;
        } else {
          const wg = workingGroups[i];
          if (!wg) continue;
          const d = getCostDets(wg.memberIds);
          virtualTotalPureCost += d.costWithoutReward;
          virtualTotalReward += d.requestReward;
        }
      }
      simulationHistory.push({ pureCost: virtualTotalPureCost, reward: virtualTotalReward });
    }

    const d1Old = getCostDets(g1.memberIds);
    const d2Old = getCostDets(g2.memberIds);
    const oldCost = (d1Old.costWithoutReward - d1Old.requestReward) + (d2Old.costWithoutReward - d2Old.requestReward);

    const d1New = getCostDets(newG1Ids);
    const d2New = getCostDets(newG2Ids);
    const newCost = (d1New.costWithoutReward - d1New.requestReward) + (d2New.costWithoutReward - d2New.requestReward);

    if (newCost < oldCost) {
      g1.memberIds = newG1Ids;
      g2.memberIds = newG2Ids;
    }
  }

  let actualCost = 0;
  if (withHistory) {
    workingGroups.forEach(g => {
      actualCost += getCostDets(g.memberIds).costWithoutReward;
    });
  }

  return {
    updatedGroups: workingGroups as SessionGroup[],
    costLog: simulationHistory,
    actualCost
  };
}
