import { describe, it, expect } from 'vitest';
import { getGroupCostDets, CostCalculationContext } from './groupCostFunction';
import { Member } from '../../types';
import type { Timestamp } from 'firebase/firestore';

describe('groupCostFunction', () => {
  const createContext = (overrides?: Partial<CostCalculationContext>): CostCalculationContext => ({
    overallGenderRatio: 0.5,
    vPool: 1.0,
    globalSTarget: 1.0,
    globalAttVar: 1.0,
    globalAttAvg: 2.0,
    memberAttendanceCount: {},
    memberPairRecentCounts: {},
    memberPairLastSession: {},
    requestedPairs: [],
    ...overrides,
  });

  const createMember = (overrides?: Partial<Member>): Member => ({
    id: '1',
    name: 'User',
    studentId: '20211111',
    gender: '남',
    semester: '1',
    nickname: '',
    phone: '',
    preferredGenre: [],
    createdAt: { toMillis: () => 0 } as unknown as Timestamp,
    ...overrides,
  });

  it('calculates age (semester) variance penalty correctly', () => {
    // Both 21 numbers logic: 21 and 21 => vGroup = 0.
    // vPool = 2.0, so penalty = ((0 - 2) / 2) * 2 = -2
    const mem1 = createMember({ id: '1', studentId: '20210001', semester: '1' });
    const mem2 = createMember({ id: '2', studentId: '20210002', semester: '2' });
    const ctx = createContext({ vPool: 2.0, globalSTarget: 0.0, globalAttVar: 0.0, overallGenderRatio: 0.0 });
    const result = getGroupCostDets([mem1, mem2], ctx);
    
    // cost should be around -2 form ageVarCost + 0 sem penalty + 0 from other
    expect(result.costWithoutReward).toBeLessThan(0);
  });

  it('calculates gender ratio penalty correctly', () => {
    const mem1 = createMember({ gender: '남' });
    const mem2 = createMember({ gender: '남' });
    // Group is 100% male. Ratio = 0.5. error = 0.5. Expected Error = sqrt(0.25 / 2) = 0.353
    // cost = ((0.5 - 0.353) / 0.363) * 2.5 > 0
    const ctx = createContext({ overallGenderRatio: 0.5, vPool: 0, globalSTarget: 0, globalAttVar: 0 });
    const result = getGroupCostDets([mem1, mem2], ctx);
    expect(result.costWithoutReward).toBeGreaterThan(0);
  });

  it('calculates reunion penalty correctly', () => {
    const mem1 = createMember({ id: 'm1' });
    const mem2 = createMember({ id: 'm2' });
    
    const pair = 'm1|m2';
    const ctx = createContext({
      memberPairRecentCounts: { [pair]: 2 },
      memberPairLastSession: { [pair]: true },
      vPool: 0, globalSTarget: 0, globalAttVar: 0, overallGenderRatio: -1
    });

    const result = getGroupCostDets([mem1, mem2], ctx);
    // penalty: 2 from >= 2 counts, 0.1 from last session
    expect(result.costWithoutReward).toBeCloseTo(2.1);
  });

  it('calculates request reward correctly', () => {
    const mem1 = createMember({ id: 'm1' });
    const mem2 = createMember({ id: 'm2' });
    
    const ctx = createContext({
      requestedPairs: [{ a: 'm1', b: 'm2' }]
    });

    const result = getGroupCostDets([mem1, mem2], ctx);
    expect(result.requestReward).toBe(100);
  });
});
