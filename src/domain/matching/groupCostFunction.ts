import { Member } from '../../types';

export interface GroupCostResult {
  ageVarianceCost: number;
  experienceCost: number;
  activityCost: number;
  genderCost: number;
  reunionPenalty: number;
  costWithoutReward: number;
  requestReward: number;
}

export interface CostCalculationContext {
  overallGenderRatio: number;
  vPool: number;
  /** 0..1 long-term attendance experience, keyed by member ID. */
  memberExperience: Record<string, number>;
  /** 0..1 current-semester attendance activity, keyed by member ID. */
  memberActivity: Record<string, number>;
  overallExperienceAverage: number;
  overallActivityAverage: number;
  memberPairRecentCounts: Record<string, number>;
  memberPairLastSession: Record<string, boolean>;
  requestedPairs: { a: string; b: string }[];
}

export function getStudentYear(member: Member): number {
  return parseInt(member.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x => x) || '25');
}

function calculateAgeVarianceCost(gMems: Member[], vPool: number): number {
  if (vPool <= 0) return 0;
  const years = gMems.map(getStudentYear);
  const avgYear = years.reduce((a, b) => a + b, 0) / (years.length || 1);
  const vGroup = years.reduce((a, b) => a + Math.pow(b - avgYear, 2), 0) / (years.length || 1);
  return ((vGroup - vPool) / vPool) * 2.0;
}

export function getExperience(attendanceCount: number): number {
  const safeCount = Number.isFinite(attendanceCount) ? Math.max(0, attendanceCount) : 0;
  return 1 - Math.exp(-safeCount / 4);
}

export function getActivity(attendedOpportunities: number, totalOpportunities: number): number {
  const safeAttended = Number.isFinite(attendedOpportunities) ? Math.max(0, attendedOpportunities) : 0;
  const safeTotal = Number.isFinite(totalOpportunities) ? Math.max(0, totalOpportunities) : 0;
  return (Math.min(safeAttended, safeTotal) + 1) / (safeTotal + 2);
}

function calculateMeanBalanceCost(
  gMems: Member[],
  values: Record<string, number>,
  overallAverage: number,
  fallbackValue: number
): number {
  const groupAverage = gMems.reduce((sum, member) => {
    const value = values[member.id];
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : fallbackValue);
  }, 0) / gMems.length;
  const safeOverallAverage = Number.isFinite(overallAverage) ? overallAverage : fallbackValue;
  return Math.pow(groupAverage - safeOverallAverage, 2);
}

function calculateGenderCost(gMems: Member[], overallGenderRatio: number): number {
  if (overallGenderRatio <= 0 || overallGenderRatio >= 1) return 0;
  const n = gMems.length || 1;
  const expectedGenderError = Math.sqrt((overallGenderRatio * (1 - overallGenderRatio)) / n);
  if (expectedGenderError < 0.01) return 0;
  const groupFemaleRatio = gMems.filter(m => m.gender === '여').length / n;
  return ((Math.abs(groupFemaleRatio - overallGenderRatio) - expectedGenderError) / (expectedGenderError + 0.01)) * 2.5;
}

function calculatePairEffects(gMems: Member[], ctx: CostCalculationContext): { reunionPenalty: number, requestReward: number } {
  let reunionPenalty = 0;
  let requestReward = 0;
  for (let i = 0; i < gMems.length; i++) {
    for (let j = i + 1; j < gMems.length; j++) {
      const id1 = gMems[i]!.id;
      const id2 = gMems[j]!.id;
      const pair = [id1, id2].sort().join('|');
      
      if ((ctx.memberPairRecentCounts[pair] || 0) >= 2) reunionPenalty += 2;
      if (ctx.memberPairLastSession[pair]) reunionPenalty += 0.1;

      const matchedPair = ctx.requestedPairs.some(p => (p.a === id1 && p.b === id2) || (p.a === id2 && p.b === id1));
      if (matchedPair) requestReward += 100;
    }
  }
  return { reunionPenalty, requestReward };
}

export function getGroupCostDets(
  gMems: Member[],
  ctx: CostCalculationContext
): GroupCostResult {
  if (gMems.length === 0) return {
    ageVarianceCost: 0,
    experienceCost: 0,
    activityCost: 0,
    genderCost: 0,
    reunionPenalty: 0,
    costWithoutReward: 0,
    requestReward: 0,
  };

  const ageVarianceCost = calculateAgeVarianceCost(gMems, ctx.vPool);
  const experienceCost = calculateMeanBalanceCost(gMems, ctx.memberExperience, ctx.overallExperienceAverage, 0);
  const activityCost = calculateMeanBalanceCost(gMems, ctx.memberActivity, ctx.overallActivityAverage, 0.5);
  const genderCost = calculateGenderCost(gMems, ctx.overallGenderRatio);
  const { reunionPenalty, requestReward } = calculatePairEffects(gMems, ctx);

  // Experience and current-semester activity deliberately use the same fixed
  // 0..1 mean-balance scale and equal weight. Do not normalize by variance.
  const costWithoutReward = ageVarianceCost + experienceCost + activityCost + genderCost + reunionPenalty;
  
  return { ageVarianceCost, experienceCost, activityCost, genderCost, reunionPenalty, costWithoutReward, requestReward };
}
