import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CostEvaluationModal from './CostEvaluationModal';
import { combineScores, evaluateUtilityGroup, pairKey, REVIEW_PARAMETERS, type UtilityContext } from '../domain/matching/personalUtility';
import type { SessionGroup } from '../types';

let root: Root;
let container: HTMLDivElement;
let trigger: HTMLButtonElement;
const close = vi.fn();
const dialogDescriptors = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);
const groups: SessionGroup[] = [
  { id: 'one', name: '첫 조', memberIds: ['a', 'b', 'absent'], gameIds: [] },
  { id: 'two', name: '둘째 조', memberIds: ['c', 'd'], gameIds: [] },
  { id: 'empty', name: '빈 조', memberIds: [], gameIds: [] },
];
const context: UtilityContext = {
  parameters: REVIEW_PARAMETERS, absentRequests: [], requestChoices: [], exposures: new Map(),
  people: new Map([
    ['a', { id: 'a', memberId: 'ma', name: '김가상', gender: '여', year: 22, board: false }],
    ['b', { id: 'b', memberId: 'mb', name: '이가상', gender: '여', year: 28, board: false }],
    ['c', { id: 'c', memberId: 'mc', name: '박가상', gender: '남', year: 24, board: true }],
    ['d', { id: 'd', memberId: 'md', name: '최가상', gender: '남', year: 24, board: false }],
    ['waiting', { id: 'waiting', memberId: 'mw', name: '미배정', gender: '남', year: 24, board: false }],
  ]),
  requests: new Map([[pairKey('a', 'b'), ['a', 'b']], [pairKey('b', 'c'), ['b', 'c']]]),
};
const render = (props: { isOpen?: boolean; context?: UtilityContext | null; groups?: SessionGroup[] } = {}) => act(() => {
  root.render(<CostEvaluationModal isOpen={props.isOpen ?? true} context={props.context === undefined ? context : props.context}
    groups={props.groups ?? groups} onClose={close} />);
});
const field = (label: string) => [...container.querySelectorAll('dt')].find(item => item.textContent === label)!.nextElementSibling!.textContent;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  close.mockClear();
  // jsdom has no top layer. Browser focus trapping/Esc are checked by the Emulator CI test.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
  container = document.createElement('div');
  trigger = document.createElement('button');
  document.body.append(trigger, container);
  trigger.focus();
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove(); trigger.remove(); vi.restoreAllMocks();
  for (const name of ['showModal', 'close'] as const) {
    const descriptor = dialogDescriptors[name];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

it('shows globally protected scores, fulfilled pairs and partial coverage without counting empty groups', () => {
  render();
  const local = groups.map(group => evaluateUtilityGroup(group.memberIds.filter(id => context.people.has(id)), context));
  const global = combineScores(local, context.parameters);
  const person = global.people.find(person => person.id === 'a')!;
  expect(person.protectionWeight.toFixed(2)).not.toBe(local[0]!.people[0]!.protectionWeight.toFixed(2));
  expect(field('보호 계수')).toBe(person.protectionWeight.toFixed(2));
  expect(field('평가 기여분')).toBe(person.protectedUtility.toFixed(2));
  const summary = container.querySelector('[aria-label="전체 편성 요약"]')!;
  expect(summary.textContent).toContain('1 / 2쌍');
  expect(summary.textContent).toContain('1 / 2개 조');
  expect(summary.textContent).toContain(global.welfare.toFixed(2));
  expect(container.textContent).toContain('현재 배치된 등록 참석자 4명을 평가합니다.');
  expect(container.querySelector('select')!.options).toHaveLength(2);
});

it('changes group and member details and safely falls back when the selected group disappears', () => {
  render();
  act(() => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="평가할 조 선택"] button')][1]!.click());
  const select = container.querySelector('select')!;
  expect(select.value).toBe('c');
  act(() => { select.value = 'd'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[aria-label="최가상 세부 지표"]')).not.toBeNull();
  render({ groups: [groups[0]!] });
  expect(container.querySelector('[aria-label="김가상 세부 지표"]')).not.toBeNull();
  render({ groups: [] });
  expect(container.textContent).toContain('조에 참석자를 배치하면 개인별 지표를 확인할 수 있습니다.');
  expect(container.querySelector('select')).toBeNull();
});

it('reports unavailable evaluation data instead of displaying a zero score', () => {
  render({ context: null });
  expect(container.textContent).toContain('평가 자료를 사용할 수 없습니다.');
  expect(container.querySelector('[aria-label="전체 편성 요약"]')).toBeNull();
  expect(container.querySelector('[aria-label="조별 개인 평가"] dt')).toBeNull();
});

it('requests close on cancel, restores scrolling and returns focus when closed', () => {
  document.body.style.overflow = 'auto';
  render();
  expect(document.body.style.overflow).toBe('hidden');
  act(() => { container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })); });
  expect(close).toHaveBeenCalledOnce();
  render({ isOpen: false });
  expect(document.body.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(trigger);
  document.body.style.overflow = '';
});
