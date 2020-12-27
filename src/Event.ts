import Ajv from 'ajv';
import type { EventBridge } from 'aws-sdk';
import { FromSchema } from 'json-schema-to-ts';
import middy from '@middy/core';
import type { Context, EventBridgeEvent } from 'aws-lambda';

import { Bus } from './Bus';

const ajv = new Ajv();

export class Event<
  N extends string,
  S extends Record<string, unknown>,
  P = FromSchema<S>
> {
  private _name: N;
  private _source: string;
  private _bus: Bus;
  private _schema: S;
  private _validate: Ajv.ValidateFunction;
  private _pattern: { 'detail-type': [N]; source: string[] };

  constructor({
    name,
    source,
    bus,
    schema,
  }: {
    name: N;
    source: string;
    bus: Bus;
    schema: S;
  }) {
    this._name = name;
    this._source = source;
    this._bus = bus;
    this._schema = schema;
    this._validate = ajv.compile(schema);
    this._pattern = { source: [source], 'detail-type': [name] };
  }

  get name(): N {
    return this._name;
  }

  get source(): string {
    return this._source;
  }

  get bus(): Bus {
    return this._bus;
  }

  get schema(): S {
    return this._schema;
  }

  get pattern(): { 'detail-type': [N]; source: string[] } {
    return this._pattern;
  }

  async publish(event: P): Promise<EventBridge.PutEventsResponse> {
    if (!this._validate(event)) {
      throw new Error('Event doest not satisfy schema');
    }
    return this._bus.put([
      { Source: this._source, DetailType: this._name, Detail: event },
    ]);
  }

  validationMiddleware(): middy.MiddlewareObject<
    EventBridgeEvent<N, P>,
    unknown,
    Context
  > {
    return {
      before: (handler, next) => {
        if (!this._validate(handler.event.detail)) {
          throw new Error('Object validation failed');
        }

        next();
      },
    };
  }
}

type GenericEvent = Event<
  string,
  Record<string, unknown>,
  Record<string, unknown>
>;

export type PublishedEvent<Event extends GenericEvent> = EventBridgeEvent<
  Event['name'],
  FromSchema<Event['schema']>
>;
