import type EventBridge from 'aws-sdk/clients/eventbridge';
import { PutEventsResultEntryList } from 'aws-sdk/clients/eventbridge';

import { Event } from './Event';

export interface BusPutEvent {
  Source: string;
  DetailType: string;
  Detail?: unknown;
}

type ChunkedEntriesAccumulator = {
  chunkedEntries: EventBridge.PutEventsRequestEntry[][];
  lastChunkSize: number;
  lastChunkLength: number;
};

export class Bus {
  private _name: string;
  private _eventBridge: EventBridge;
  constructor({
    name,
    EventBridge,
  }: {
    name: string;
    EventBridge: EventBridge;
  }) {
    this._name = name;
    this._eventBridge = EventBridge;
  }

  async put(events: BusPutEvent[]): Promise<EventBridge.PutEventsResponse> {
    const entries = events.map((entry) =>
      Object.assign(
        {},
        { ...entry },
        {
          Detail: JSON.stringify(entry.Detail),
          EventBusName: this._name,
        },
      ),
    );

    const chunkedEntries = chunkEntries(entries);
    const results = await Promise.all(
      chunkedEntries.map((chunk) =>
        this._eventBridge.putEvents({ Entries: chunk }).promise(),
      ),
    );

    return results.reduce<{
      Entries: PutEventsResultEntryList;
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

export function computeEventSize(
  event: EventBridge.PutEventsRequestEntry,
): number {
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
  events: EventBridge.PutEventsRequestEntry[],
): ChunkedEntriesAccumulator['chunkedEntries'] {
  return events.reduce<ChunkedEntriesAccumulator>(
    (
      chunkedEntriesAccumulator: ChunkedEntriesAccumulator,
      entry: EventBridge.PutEventsRequestEntry,
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
