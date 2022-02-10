import type {
  EventBridgeClient,
  PutEventsResponse,
  PutEventsRequestEntry,
  PutEventsResultEntry,
} from '@aws-sdk/client-eventbridge';
import { PutEventsCommand } from '@aws-sdk/client-eventbridge';

import { Event } from './Event';

type ChunkedEntriesAccumulator = {
  chunkedEntries: PutEventsRequestEntry[][];
  lastChunkSize: number;
  lastChunkLength: number;
};

export class Bus {
  private _name: string;
  private _eventBridge: EventBridgeClient;
  constructor({
    name,
    EventBridge,
  }: {
    name: string;
    EventBridge: EventBridgeClient;
  }) {
    this._name = name;
    this._eventBridge = EventBridge;
  }

  async put(events: PutEventsRequestEntry[]): Promise<PutEventsResponse> {
    const entries = events.map((entry) =>
      Object.assign({}, { ...entry }, { EventBusName: this._name }),
    );

    const chunkedEntries = chunkEntries(entries);
    const results = await Promise.all(
      chunkedEntries.map((chunk) => {
        const putEventsCommand = new PutEventsCommand({ Entries: chunk });
        return this._eventBridge.send(putEventsCommand);
      }),
    );

    return results.reduce<{
      Entries: PutEventsResultEntry[];
      FailedEntryCount: number;
    }>(
      (returnValue, result) => {
        if (result.FailedEntryCount) {
          returnValue.FailedEntryCount += result.FailedEntryCount;
        }
        if (result.Entries) {
          returnValue.Entries.push(...result.Entries);
        }

        return returnValue;
      },
      { Entries: [], FailedEntryCount: 0 },
    );
  }

  computePattern(events: Event<string, Record<string, unknown>>[]): {
    source?: string[];
    'detail-type'?: string[];
  } {
    const pattern = {};
    const areAllEventSourcesEqual = events.every(
      (event) => event.source === events[0].source,
    );
    const areAllEventDetailTypesEqual = events.every(
      (event) => event.name === events[0].name,
    );

    if (areAllEventSourcesEqual || areAllEventDetailTypesEqual) {
      Object.assign(pattern, { source: events.map((event) => event.source) });
    }
    Object.assign(pattern, {
      'detail-type': events.map((event) => event.name),
    });

    return pattern;
  }
}

export function computeEventSize(event: PutEventsRequestEntry): number {
  let size = 0;

  if (event.Time) size += 14;
  if (event.Detail) size += Buffer.byteLength(event.Detail, 'utf8');
  if (event.DetailType) size += Buffer.byteLength(event.DetailType, 'utf8');
  if (event.Source) size += Buffer.byteLength(event.Source, 'utf8');
  if (event.Resources) {
    event.Resources.forEach((resource) => Buffer.byteLength(resource, 'utf8'));
  }

  return size;
}

export function chunkEntries(
  events: PutEventsRequestEntry[],
): ChunkedEntriesAccumulator['chunkedEntries'] {
  return events.reduce<ChunkedEntriesAccumulator>(
    (
      chunkedEntriesAccumulator: ChunkedEntriesAccumulator,
      entry: PutEventsRequestEntry,
    ) => {
      const { chunkedEntries, lastChunkSize, lastChunkLength } =
        chunkedEntriesAccumulator;
      const eventSize = computeEventSize(entry);

      if (lastChunkSize + eventSize > 256000 || lastChunkLength === 10)
        return {
          chunkedEntries: [...chunkedEntries, [entry]],
          lastChunkSize: eventSize,
          lastChunkLength: 1,
        };

      const lastChunk = chunkedEntries.pop() ?? [];

      return {
        chunkedEntries: [...chunkedEntries, [...lastChunk, entry]],
        lastChunkSize: lastChunkSize + eventSize,
        lastChunkLength: lastChunkLength + 1,
      };
    },
    {
      chunkedEntries: [],
      lastChunkSize: 0,
      lastChunkLength: 0,
    },
  ).chunkedEntries;
}
