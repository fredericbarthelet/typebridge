import { EventBridge } from 'aws-sdk'
import { Bus } from './Bus';
import { Event } from './Event';

describe('Event', () => {
  describe('#construct', () => {
    it('should compute event size', () => {
      const myBus = new Bus({
        name: 'test',
        EventBridge: new EventBridge()
      });
      const schema = {
        type: 'object',
        properties: {
          attribute: { type: 'string' },
          numberAttribute: { type: 'number' },
        },
        additionalProperties: false,
        required: ['attribute']
      } as const;
      const myEvent = new Event({
        name: 'toto',
        source: 'source',
        bus: myBus,
        schema
      })

      myEvent.publish({
        attribute: 'hello',
        numberAttribute: 12
      })
    });
  });
});
