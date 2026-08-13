import { Member } from '../../types';

export interface GroupCostResult {
  costWithoutReward: number;
  requestReward: number;
}

export interface CostCalculationContext {
  overallGenderRatio: number;
  vPool: number;
  globalSTarget: number;
  globalAttVar: number;
  globalAttAvg: number;
  memberAttendanceCount: Record<string, number>;
  memberPairRecentCounts: Record<string, number>;
  memberPairLastSession: Record<string, boolean>;
  requestedPairs: { a: string; b: string }[];
}

function calculateAgeVarianceCost(gMems: Member[], vPool: number): number {
  if (vPool <= 0) return 0;
  const years = gMems.map(m => parseInt(m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x => x) || '25'));
  const avgYear = years.reduce((a, b) => a + b, 0) / (years.length || 1);
  const vGroup = years.reduce((a, b) => a + Math.pow(b - avgYear, 2), 0) / (years.length || 1);
  return ((vGroup - vPool) / vPool) * 2.0;
}

function calculateSemesterPenalty(gMems: Member[], globalSTarget: number): number {
  if (globalSTarget <= 0) return 0;
  const semCounts = {} as Record<string, number>;
  gMems.forEach(m => semCounts[m.semester || ''] = (semCounts[m.semester || ''] || 0) + 1);
  let sGroup = 0;
  Object.values(semCounts).forEach(c => sGroup += Math.pow(c - 1, 2));
  return (sGroup - globalSTarget) / globalSTarget;
}

function calculateAttendanceVarianceCost(gMems: Member[], ctx: CostCalculationContext): number {
  if (ctx.globalAttVar < 0.1) return 0;
  const attCounts = gMems.map(m => ctx.memberAttendanceCount[m.id] || 0);
  const avgAtt = attCounts.reduce((a, b) => a + b, 0) / (attCounts.length || 1);
  const expectedGroupVarAtt = ctx.globalAttVar / (gMems.length || 1);
  return (((Math.pow(avgAtt - ctx.globalAttAvg, 2)) - expectedGroupVarAtt) / (expectedGroupVarAtt + 0.01)) * 2.0;
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
  if (gMems.length === 0) return { costWithoutReward: 0, requestReward: 0 };

  const ageVarCost = calculateAgeVarianceCost(gMems, ctx.vPool);
  const semPenalty = calculateSemesterPenalty(gMems, ctx.globalSTarget);
  const attVarCost = calculateAttendanceVarianceCost(gMems, ctx);
  const genderCost = calculateGenderCost(gMems, ctx.overallGenderRatio);
  const { reunionPenalty, requestReward } = calculatePairEffects(gMems, ctx);

  const costWithoutReward = ageVarCost + (semPenalty * 2.0) + attVarCost + genderCost + reunionPenalty;
  
  return { costWithoutReward, requestReward };
}
