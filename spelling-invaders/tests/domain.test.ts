import { describe, expect, it } from 'vitest';
import { evaluateSpelling, gradeFor, masteryFor, newList, normalizeAnswer, parseWords, pointsForAttempt } from '../src/domain';
describe('spelling domain',()=>{
  it('normalizes harmless case and whitespace but preserves spelling',()=>{ expect(normalizeAnswer('  Space  Ship ')).toBe('space ship'); expect(evaluateSpelling(' Adventure ','adventure')).toBe(true); expect(evaluateSpelling('adventur','adventure')).toBe(false); });
  it('scores first, retry, and exhausted attempts distinctly',()=>{ expect(pointsForAttempt(1)).toBe(100); expect(pointsForAttempt(2)).toBe(50); expect(pointsForAttempt(3)).toBe(25); expect(pointsForAttempt(4)).toBe(0); });
  it('removes duplicate pasted words without accepting blanks',()=>{ expect(parseWords('planet\nPlanet,\n galaxy ')).toEqual(['planet','galaxy']); });
  it('creates an editable weekly list',()=>{ const list=newList('Week 2','2026-10-13','one,two,one'); expect(list.name).toBe('Week 2'); expect(list.words.map(w=>w.text)).toEqual(['one','two']); });
  it('uses a transparent mastery threshold and conventional grades',()=>{ expect(masteryFor({attempts:1,firstTry:1,correct:1,incorrect:0,lastSeen:''})).toBe('learning'); expect(masteryFor({attempts:3,firstTry:2,correct:3,incorrect:0,lastSeen:''})).toBe('mastered'); expect(gradeFor(18,20)).toBe('A'); expect(gradeFor(11,20)).toBe('F'); });
});
