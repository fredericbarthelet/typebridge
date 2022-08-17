import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { promisify } from 'util';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { mockClient } from 'aws-sdk-client-mock';
import type { Handler } from 'aws-lambda';
import context from 'aws-lambda-mock-context';
import createError from 'http-errors';
import middy from '@middy/core';
import jsonValidator from '@middy/validator';

import { Bus } from './Bus';
import { Event } from './Event';
import { DescribeSchemaCommand, DescribeSchemaCommandOutput, SchemasClient } from '@aws-sdk/client-schemas';

function invoke(handler: Handler, event = {}) {
  return promisify(handler)(event, context({ timeout: 1 }));
}

// Required by aws-lambda-mock-context getRemainingTimeInMillis functionality
jest.useFakeTimers();

describe('Event', () => {
  describe('#construct', () => {
    const eventBridgeMock = mockClient(EventBridgeClient);

    eventBridgeMock
      .on(PutEventsCommand)
      .resolves({ Entries: [{ EventId: '123456' }] });

    const myBus = new Bus({
      name: 'test',
      // @ts-expect-error Mocking library mocked client is not type compatible with actual client
      EventBridge: eventBridgeMock,
    });

    const schema = {
      type: 'object',
      properties: {
        attribute: { type: 'string' },
        numberAttribute: { type: 'number' },
      },
      additionalProperties: false,
      required: ['attribute'],
    } as const;

    const myEvent = new Event({
      name: 'myEvent',
      source: 'source',
      bus: myBus,
      schema,
    });

    afterAll(() => {
      eventBridgeMock.reset();
    });

    it('should allow publishing an event', async () => {
      expect(
        await myEvent.publish({
          attribute: 'hello',
          numberAttribute: 12,
        }),
      ).toHaveProperty('Entries', [{ EventId: '123456' }]);
    });

    it('should fail with the use of validationMiddleware on wrong event', () => {
      const handler: Handler = (_event, _ctx, callback) => callback(null, '5');
      const middyfiedHandler = middy(handler).use(
        jsonValidator({ inputSchema: myEvent.publishedEventSchema }),
      );

      expect(
        invoke(middyfiedHandler, {
          source: myEvent.source,
          'detail-type': myEvent.name,
          detail: {
            otherAttribute: 'hello',
          },
        }),
      ).rejects.toEqual(
        new createError.BadRequest('Event object failed validation'),
      );

      expect(
        invoke(middyfiedHandler, {
          source: 'unexpected source',
          'detail-type': myEvent.name,
          detail: {
            attribute: 'goodbye',
            numberAttribute: 23,
          },
        }),
      ).rejects.toEqual(
        new createError.BadRequest('Event object failed validation'),
      );

      expect(
        invoke(middyfiedHandler, {
          source: myEvent.source,
          'detail-type': 'unexpected detail type',
          detail: {
            attribute: 'goodbye',
            numberAttribute: 23,
          },
        }),
      ).rejects.toEqual(
        new createError.BadRequest('Event object failed validation'),
      );
    });

    it('should succeed with the use of validationMiddleware on correct event', () => {
      const handler: Handler = (_event, _ctx, callback) =>
        callback(null, 'returnValue');
      const middyfiedHandler = middy(handler).use(
        jsonValidator({ inputSchema: myEvent.publishedEventSchema }),
      );

      expect(
        invoke(middyfiedHandler, {
          source: myEvent.source,
          'detail-type': myEvent.name,
          detail: {
            attribute: 'goodbye',
            numberAttribute: 23,
          },
        }),
      ).resolves.toEqual('returnValue');
    });

    it('should compute correct pattern', async () => {
      expect(myEvent.pattern).toStrictEqual({
        'detail-type': ['myEvent'],
        source: ['source'],
      });
    });

    it('should create event pattern', () => {
      expect(
        myEvent.create({
          attribute: 'hello',
          numberAttribute: 12,
        }),
      ).toEqual({
        Source: 'source',
        DetailType: 'myEvent',
        Detail: JSON.stringify({
          attribute: 'hello',
          numberAttribute: 12,
        }),
      });
    });
  });

  describe('#constructLiveValidation', () => {
    const eventBridgeMock = mockClient(EventBridgeClient);
    const schemasMock = mockClient(SchemasClient);

    eventBridgeMock
      .on(PutEventsCommand)
      .resolves({ Entries: [{ EventId: '123456' }] });

    const MyEventPayloadSchema = JSON.stringify({
      type: 'object',
      properties: {
        stringAttribute: { type: 'string' },
        numberAttribute: { type: 'integer' },
      },
      required: ['stringAttribute'],
      additionalProperties: false
    });

    schemasMock
      .on(DescribeSchemaCommand)
      .resolves({ Content: MyEventPayloadSchema.toString() } as DescribeSchemaCommandOutput);


    const myBus = new Bus({
      name: 'test',
      // @ts-expect-error Mocking library mocked client is not type compatible with actual client
      EventBridge: eventBridgeMock,
    });

    const myEvent = new Event({
      name: 'myEvent',
      source: 'source',
      bus: myBus,
      schema: 'testSchemaName',
      registryName: "wop"
    });

    afterAll(() => {
      eventBridgeMock.reset();
      schemasMock.reset();
    });

    it('should allow publishing an event', async () => {
      expect(
        await myEvent.publish({
          attribute: 'hello',
          numberAttribute: 12,
        }),
      ).toHaveProperty('Entries', [{ EventId: '123456' }]);
    });

    it('should fail with the use of validationMiddleware on wrong event', () => {
      const handler: Handler = (_event, _ctx, callback) => callback(null, '5');
      const middyfiedHandler = middy(handler).use(
        jsonValidator({ inputSchema: myEvent.publishedEventSchema }),
      );

      expect(
        invoke(middyfiedHandler, {
          source: myEvent.source,
          'detail-type': myEvent.name,
          detail: {
            otherAttribute: 'hello',
          },
        }),
      ).rejects.toEqual(
        new createError.BadRequest('Event object failed validation'),
      );

      expect(
        invoke(middyfiedHandler, {
          source: 'unexpected source',
          'detail-type': myEvent.name,
          detail: {
            attribute: 'goodbye',
            numberAttribute: 23,
          },
        }),
      ).rejects.toEqual(
        new createError.BadRequest('Event object failed validation'),
      );

      expect(
        invoke(middyfiedHandler, {
          source: myEvent.source,
          'detail-type': 'unexpected detail type',
          detail: {
            attribute: 'goodbye',
            numberAttribute: 23,
          },
        }),
      ).rejects.toEqual(
        new createError.BadRequest('Event object failed validation'),
      );
    });

    it('should succeed with the use of validationMiddleware on correct event', () => {
      const handler: Handler = (_event, _ctx, callback) =>
        callback(null, 'returnValue');
      const middyfiedHandler = middy(handler).use(
        jsonValidator({ inputSchema: myEvent.publishedEventSchema }),
      );

      expect(
        invoke(middyfiedHandler, {
          source: myEvent.source,
          'detail-type': myEvent.name,
          detail: {
            attribute: 'goodbye',
            numberAttribute: 23,
          },
        }),
      ).resolves.toEqual('returnValue');
    });

    it('should compute correct pattern', async () => {
      expect(myEvent.pattern).toStrictEqual({
        'detail-type': ['myEvent'],
        source: ['source'],
      });
    });

    it('should create event pattern', () => {
      expect(
        myEvent.create({
          attribute: 'hello',
          numberAttribute: 12,
        }),
      ).toEqual({
        Source: 'source',
        DetailType: 'myEvent',
        Detail: JSON.stringify({
          attribute: 'hello',
          numberAttribute: 12,
        }),
      });
    });
  });
});
