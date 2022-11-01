import { Bus, chunkEntries, computeEventSize } from './Bus';
import { mockClient } from 'aws-sdk-client-mock';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';

const smallEntry = {
  Detail: 'small'.repeat(Math.round(25000 / 5)), // ~ 25Kb
};
const bigEntry = {
  Detail: 'big'.repeat(Math.round(100000 / 3)), // ~ 100Kb
};
const failEntry = {
  Detail: 'fail',
};
const successEntry = {
  Detail: 'success',
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
  describe('#put', () => {
    const eventBridgeClientMock = mockClient(EventBridgeClient);
    const bus = new Bus({
      name: 'testBus',
      // @ts-expect-error Mocking library mocked client is not type compatible with actual client
      EventBridge: eventBridgeClientMock,
    });
    beforeEach(() => {
      eventBridgeClientMock.reset();
    });
    it('should return events command payload with results', () => {
      const testCase = [
        failEntry,
        successEntry,
        successEntry,
        failEntry,
        successEntry,
        failEntry,
        successEntry,
      ];
      eventBridgeClientMock.on(PutEventsCommand).resolves({
        FailedEntryCount: 3,
        Entries: [
          { ErrorCode: '12', ErrorMessage: 'There was an error' },
          { EventId: '97a200f1-6919-4619-ac2f-e0026ebb15b7' },
          { EventId: 'e4c40e6a-1fc0-4f5a-82b3-c6c284d772ca' },
          { ErrorCode: '13', ErrorMessage: 'There was an error' },
          { EventId: '1cdf5682-6f5c-4c21-b922-f83d06447952' },
          { ErrorCode: '14', ErrorMessage: 'There was an error' },
          { EventId: '9039f372-d810-474b-9741-b369394cefef' },
        ],
      });
      const failEntryResultBuilder = (code: string) => ({
        ErrorCode: code,
        ErrorMessage: 'There was an error',
        Detail: 'fail',
        EventBusName: 'testBus',
      });
      const successEntryResultBuilder = (id: string) => ({
        EventId: id,
        Detail: 'success',
        EventBusName: 'testBus',
      });
      expect(bus.put(testCase)).resolves.toEqual({
        FailedEntryCount: 3,
        Entries: [
          failEntryResultBuilder('12'),
          successEntryResultBuilder('97a200f1-6919-4619-ac2f-e0026ebb15b7'),
          successEntryResultBuilder('e4c40e6a-1fc0-4f5a-82b3-c6c284d772ca'),
          failEntryResultBuilder('13'),
          successEntryResultBuilder('1cdf5682-6f5c-4c21-b922-f83d06447952'),
          failEntryResultBuilder('14'),
          successEntryResultBuilder('9039f372-d810-474b-9741-b369394cefef'),
        ],
      });
    });
  });
  describe('#computeEventSize', () => {
    it('should compute event size', () => {
      expect(
        computeEventSize({
          DetailType: 'myType',
          Detail: JSON.stringify({ property: 'value' }),
        }),
      ).toBe(26);
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
