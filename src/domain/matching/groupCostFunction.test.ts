import { describe, it, expect } from 'vitest';
import { getActivity, getExperience, getGroupCostDets, CostCalculationContext } from './groupCostFunction';
import { Member } from '../../types';
import type { Timestamp } from 'firebase/firestore';

describe('groupCostFunction', () => {
  const createContext = (overrides?: Partial<CostCalculationContext>): CostCalculationContext => ({
    overallGenderRatio: 0.5,
    vPool: 1.0,
    memberExperience: {},
    memberActivity: {},
    overallExperienceAverage: 0,
    overallActivityAverage: 0,
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

  it('calculates student-year variance penalty correctly', () => {
    // Both 21 numbers logic: 21 and 21 => vGroup = 0.
    // vPool = 2.0, so penalty = ((0 - 2) / 2) * 2 = -2
    const mem1 = createMember({ id: '1', studentId: '20210001', semester: '1' });
    const mem2 = createMember({ id: '2', studentId: '20210002', semester: '2' });
    const ctx = createContext({ vPool: 2.0, overallGenderRatio: 0.0 });
    const result = getGroupCostDets([mem1, mem2], ctx);
    
    // The student-year variance term reduces the total cost for this group.
    expect(result.costWithoutReward).toBeLessThan(0);
  });

  it('exposes the scored terms used by diagnostics without changing the total or pair rewards', () => {
    const members = [createMember({ id: 'm1' }), createMember({ id: 'm2' })];
    const ctx = createContext({
      overallGenderRatio: 0,
      vPool: 2,
      memberExperience: { m1: 0.1, m2: 0.3 },
      memberActivity: { m1: 0.6, m2: 0.8 },
      overallExperienceAverage: 0.5,
      overallActivityAverage: 0.5,
      memberPairRecentCounts: { 'm1|m2': 2 },
      memberPairLastSession: { 'm1|m2': true },
      requestedPairs: [{ a: 'm1', b: 'm2' }, { a: 'm2', b: 'm1' }],
    });
    const result = getGroupCostDets(members, ctx);

    expect(result.ageVarianceCost).toBe(-2);
    expect(result.experienceCost).toBeCloseTo(0.09);
    expect(result.activityCost).toBeCloseTo(0.04);
    expect(result.genderCost).toBe(0);
    expect(result.reunionPenalty).toBe(2.1);
    expect(result.costWithoutReward).toBeCloseTo(0.23);
    expect(result.costWithoutReward).toBe(
      result.ageVarianceCost + result.experienceCost + result.activityCost + result.genderCost + result.reunionPenalty
    );
    expect(result.requestReward).toBe(100);
  });

  it('returns zero for every scored term in an empty group', () => {
    const result = getGroupCostDets([], createContext());
    expect(result).toEqual({
      ageVarianceCost: 0,
      experienceCost: 0,
      activityCost: 0,
      genderCost: 0,
      reunionPenalty: 0,
      costWithoutReward: 0,
      requestReward: 0,
    });
  });

  it('calculates gender ratio penalty correctly', () => {
    const mem1 = createMember({ gender: '남' });
    const mem2 = createMember({ gender: '남' });
    // Group is 100% male. Ratio = 0.5. error = 0.5. Expected Error = sqrt(0.25 / 2) = 0.353
    // cost = ((0.5 - 0.353) / 0.363) * 2.5 > 0
    const ctx = createContext({ overallGenderRatio: 0.5, vPool: 0 });
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
      memberActivity: { m1: 0, m2: 0 },
      vPool: 0, overallGenderRatio: -1
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

  it('uses fixed-scale, equally weighted experience and activity costs', () => {
    const member = createMember({ id: 'm1' });
    const ctx = createContext({
      vPool: 0,
      overallGenderRatio: 0,
      memberExperience: { m1: 0.2 },
      memberActivity: { m1: 0.7 },
      overallExperienceAverage: 0.5,
      overallActivityAverage: 0.5,
    });

    expect(getGroupCostDets([member], ctx).costWithoutReward).toBeCloseTo(0.13);
  });

  it('converts representative attendance cases to the requested experience and activity scales', () => {
    // Case A: complete newcomer
    expect(getExperience(0)).toBe(0);
    expect(getExperience(1)).toBeCloseTo(1 - Math.exp(-1 / 4));
    // Case B: one attended session as a newcomer
    expect(getActivity(1, 1)).toBeCloseTo(2 / 3);
    // Case C: regular existing member
    expect(getExperience(10)).toBeCloseTo(1 - Math.exp(-10 / 4));
    expect(getActivity(4, 5)).toBeCloseTo(5 / 7);
    // Case F: no current-semester records stays neutral.
    expect(getActivity(0, 0)).toBe(0.5);
  });

  it('uses distinct missing-value fallbacks for experience and activity', () => {
    const member = createMember({ id: 'm1' });
    const base = { vPool: 0, overallGenderRatio: 0 };

    expect(getGroupCostDets([member], createContext({
      ...base,
      overallExperienceAverage: 0.5,
      overallActivityAverage: 0.5,
    })).costWithoutReward).toBeCloseTo(0.25);
    expect(getGroupCostDets([member], createContext({
      ...base,
      overallExperienceAverage: 0,
      overallActivityAverage: 0,
    })).costWithoutReward).toBeCloseTo(0.25);
  });
});
