import { Bus } from './Bus';
import { Event } from './Event';

import { mockClient } from 'aws-sdk-client-mock';
import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DescribeSchemaCommand, DescribeSchemaCommandOutput, SchemasClient } from '@aws-sdk/client-schemas';


describe("asd", () => {
  describe('#constructLiveValidation', () => {
    const eventBridgeMock = mockClient(EventBridgeClient);
    const schemasMock = mockClient(SchemasClient);

    eventBridgeMock
      .on(PutEventsCommand)
      .resolves({ Entries: [{ EventId: '123456' }] });

    const MyEventPayloadSchema = {
      "info": {
        "version": "1.0.0",
        "title": "TaskClosed",
        "description": "Event attempted to be published on TaskClosing, delivery not guaranteed."
      },
      "paths": {},
      "components": {
        "schemas": {
          "AWSEvent": {
            "type": "object",
            "required": [
              "account",
              "detail",
              "detail-type",
              "id",
              "region",
              "source",
              "version",
              "time"
            ],
            "properties": {
              "detail": {
                "$ref": "#/components/schemas/Task_closed"
              },
              "account": {
                "type": "string"
              },
              "detail-type": {
                "type": "string"
              },
              "id": {
                "type": "string"
              },
              "region": {
                "type": "string"
              },
              "source": {
                "type": "string"
              },
              "version": {
                "type": "string"
              },
              "time": {
                "type": "string",
                "format": "date-time"
              }
            }
          },
          "Task_closed": {
            "type": "object",
            "required": [
              "clientId",
              "partnerId",
              "taskTypeId",
              "country",
              "clientCountry"
            ],
            "properties": {
              "clientId": {
                "type": "number"
              },
              "partnerId": {
                "type": "number"
              },
              "taskTypeId": {
                "type": "number"
              },
              "country": {
                "type": "string"
              },
              "clientCountry": {
                "type": "string"
              }
            }
          }
        }
      }
    };

    schemasMock
      .on(DescribeSchemaCommand)
      .resolves({ Content: JSON.stringify(MyEventPayloadSchema) } as DescribeSchemaCommandOutput);

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
          account: "123",
          detail: {
            taskTypeId: 2,
            clientId: 123,
            partnerId: 123,
            country: "DED",
            clientCountry: "123"
          },
          "detail-type": "Task_closed",
          id: "12",
          region: "asd",
          source: "asd",
          version: "12",
          time: "2018-12-10T13:45:00.000Z"
        }),
      ).toHaveProperty('Entries', [{ EventId: '123456' }]);
    });
  });
});
