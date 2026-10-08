export interface SizeInput { id: string; targetSize?: number | null | undefined; minimum?: number }
export interface SizeSolution {
  status: 'ok';
  sizes: number[];
  assignments: { id: string; targetSize: number | null; size: number }[];
  adjustments: { id: string; from: number; to: number }[];
  penalties: { missingExtraFours: number; excessEightPlus: number; excessSevenPlus: number; repeatedLargeSizes: number; nineOrTenGroups: number };
  rank: number[];
}
export function solveGroupSizes(input: { total: number; groups: SizeInput[] }): SizeSolution | {
  status: 'infeasible'; reason: string; minTotal: number; maxTotal: number;
};
