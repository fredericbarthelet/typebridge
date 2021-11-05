import { chunkEntries, computeEventSize } from './Bus';

const smallEntry = {
  Detail: 'small'.repeat(Math.round(25000 / 5)), // ~ 25Kb
};
const bigEntry = {
  Detail: 'big'.repeat(Math.round(100000 / 3)), // ~ 100Kb
};

const cases = [
  {
    name: 'no entry',
    entries: [],
    output: [],
  },
  {
    name: 'one small enough entry',
    entries: [smallEntry],
    output: [[smallEntry]],
  },
  {
    name: '3 big entries that exceeds size limit',
    entries: new Array(3).fill(bigEntry),
    output: [[bigEntry, bigEntry], [bigEntry]],
  },
  {
    name: '10 small enough entries',
    entries: new Array(10).fill(smallEntry),
    output: [new Array(10).fill(smallEntry)],
  },
  {
    name: '5 big entries that exceeds size limit twice',
    entries: new Array(5).fill(bigEntry),
    output: [[bigEntry, bigEntry], [bigEntry, bigEntry], [bigEntry]],
  },
  {
    name: '11 small entries that exceeds length limit',
    entries: new Array(11).fill(smallEntry),
    output: [new Array(10).fill(smallEntry), [smallEntry]],
  },
  {
    name: 'small and big entries together',
    entries: [
      smallEntry,
      smallEntry,
      bigEntry,
      bigEntry,
      ...new Array(11).fill(smallEntry),
      bigEntry,
      bigEntry,
      bigEntry,
    ],
    output: [
      [smallEntry, smallEntry, bigEntry, bigEntry], // ~ 250Kb (+ 25Kb > 256Kb)
      new Array(10).fill(smallEntry), // 10 limit
      [smallEntry, bigEntry, bigEntry], // ~ 225Kb (+ 100Kb > 256Kb limit)
      [bigEntry],
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
