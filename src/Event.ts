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
  private _validate: Ajv.ValidateFunction;
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
    this._validate = ajv.compile(schema);
  }

  get name(): string {
    return this._name;
  }

  get source(): string {
    return this._source;
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

  computePattern(): { 'detail-type': string[]; source: string[] } {
    return { source: [this._source], 'detail-type': [this._name] };
  }
}
