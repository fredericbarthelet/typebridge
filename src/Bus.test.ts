import { chunkEntries, computeEventSize } from './Bus';

const entry = {
  Detail: 'small'.repeat(Math.round(50000 / 5)), // ~ 50Kb
};

const cases = [
  {
    name: 'no entry',
    entries: [],
    output: [],
  },
  {
    name: 'one small enough entry',
    entries: [entry],
    output: [[entry]],
  },
  {
    name: '5 small enough entries',
    entries: new Array(5).fill(entry),
    output: [new Array(5).fill(entry)],
  },
  {
    name: '6 entries that exceeds size limit',
    entries: new Array(6).fill(entry),
    output: [new Array(5).fill(entry), [entry]],
  },
  {
    name: '12 entries that exceeds size limit twice',
    entries: new Array(12).fill(entry),
    output: [
      new Array(5).fill(entry),
      new Array(5).fill(entry),
      [entry, entry],
    ],
  },
];

describe('Bus', () => {
  describe('#computeEventSize', () => {
    it('should compute event size', () => {
      expect(
        computeEventSize({
          DetailType: 'myType',
          Detail: JSON.stringify({ property: 'vaalue' }),
        }),
      ).toBe(27);
    });
  });

  describe('#chunkEntries', () => {
    it.each(cases)(
      'should return the chunks array for $name',
      ({ entries, output }) => {
        expect(chunkEntries(entries)).toEqual(output);
      },
    );
  });
});
