import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERF_METRIC, perfMark, perfMeasure } from '../perf';

type TMeasureCall = { name: string; options?: PerformanceMeasureOptions };

const createPerformanceStub = () => {
  const marks: string[] = [];
  const measures: TMeasureCall[] = [];
  const mark = vi.fn((name: string) => {
    marks.push(name);
  });
  const measure = vi.fn((name: string, options?: PerformanceMeasureOptions) => {
    measures.push({ name, options });
    return { name, duration: 12.5 } as PerformanceMeasure;
  });
  return { performance: { mark, measure }, marks, measures, mark, measure };
};

describe('perf', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('PERF_METRIC', () => {
    it('exposes the contract metric names', () => {
      expect(PERF_METRIC).toEqual({
        sessionOpen: 'graph.session.open',
        sessionRevisit: 'graph.session.revisit',
        interaction: 'graph.interaction',
      });
    });
  });

  describe('with the Performance API available', () => {
    it('perfMark registers the given name as a mark (P1)', () => {
      const stub = createPerformanceStub();
      vi.stubGlobal('performance', stub.performance);

      perfMark(PERF_METRIC.interaction);

      expect(stub.mark).toHaveBeenCalledTimes(1);
      expect(stub.mark).toHaveBeenCalledWith(PERF_METRIC.interaction);
      expect(stub.marks).toEqual([PERF_METRIC.interaction]);
    });

    it('perfMark accepts an arbitrary string name', () => {
      const stub = createPerformanceStub();
      vi.stubGlobal('performance', stub.performance);

      perfMark('graph.session.open.start');

      expect(stub.marks).toEqual(['graph.session.open.start']);
    });

    it('perfMeasure records the named measure from the start mark (P1)', () => {
      const stub = createPerformanceStub();
      vi.stubGlobal('performance', stub.performance);

      const duration = perfMeasure(PERF_METRIC.sessionOpen, PERF_METRIC.sessionOpen);

      expect(stub.measure).toHaveBeenCalledTimes(1);
      expect(stub.measures[0].name).toBe(PERF_METRIC.sessionOpen);
      expect(stub.measures[0].options?.start).toBe(PERF_METRIC.sessionOpen);
      expect(duration).toBe(12.5);
    });

    it('perfMeasure accepts a plain-string start mark', () => {
      const stub = createPerformanceStub();
      vi.stubGlobal('performance', stub.performance);

      perfMeasure(PERF_METRIC.sessionRevisit, 'graph.session.open');

      expect(stub.measures[0].options?.start).toBe('graph.session.open');
    });

    it('passes only structured metrics through detail (P3)', () => {
      const stub = createPerformanceStub();
      vi.stubGlobal('performance', stub.performance);

      const detail = { nodeCount: 42, phase: 'structure' as const };
      perfMeasure(PERF_METRIC.sessionOpen, PERF_METRIC.sessionOpen, detail);

      expect(stub.measures[0].options?.detail).toEqual(detail);
    });
  });

  describe('without the Performance API', () => {
    it('perfMark is a safe no-op when performance is undefined (P2)', () => {
      vi.stubGlobal('performance', undefined);

      expect(() => perfMark(PERF_METRIC.sessionOpen)).not.toThrow();
    });

    it('perfMeasure returns null when performance is undefined (P2)', () => {
      vi.stubGlobal('performance', undefined);

      expect(perfMeasure(PERF_METRIC.sessionOpen, PERF_METRIC.sessionOpen)).toBeNull();
    });

    it('is a safe no-op when the mark/measure functions are missing (P2)', () => {
      vi.stubGlobal('performance', {});

      expect(() => perfMark(PERF_METRIC.sessionOpen)).not.toThrow();
      expect(perfMeasure(PERF_METRIC.sessionOpen, PERF_METRIC.sessionOpen)).toBeNull();
    });
  });
});
