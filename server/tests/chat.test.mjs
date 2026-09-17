import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

// The test suite needs no local .env file or real credentials.
process.env.FRONTEND_URL = 'https://example.test';
process.env.GOOGLE_CALLBACK_URL = 'https://example.test/api/v1/auth/google/callback';
const { getChatHistory, sendChat } = await import('../dist/services/ChatService.js');
const { default: RoomService } = await import('../dist/services/RoomService.js');
const { default: WebSocketService } = await import('../dist/websocket/WebSocketService.js');
const { Room } = await import('../dist/models/room.model.js');
const { User } = await import('../dist/models/user.model.js');

// Exercise real chat logic with isolated database responses and socket recipients.
test('room chat authorization, validation, history and reactions', async () => {
  const roomId = 'a'.repeat(24);
  const otherId = 'b'.repeat(24);
  const socket = userId => ({ userId, readyState: 1, events: [], send(value) { this.events.push(JSON.parse(value)); } });
  const owner = socket('owner');
  const listener = socket('listener');
  const outsider = socket('outsider');
  const session = { users: new Set([owner, listener]), roomName: 'Test room' };
  RoomService.rooms.set(roomId, session);
  RoomService.rooms.set(otherId, { users: new Set([outsider]) });
  const originalRoom = Room.findById;
  const originalUser = User.findById;
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  let members = ['listener'];
  Room.findById = async id => id === roomId ? { owner: 'owner', users: members } : null;
  User.findById = id => ({ select: async () => ({ name: id === 'owner' ? 'Host' : 'Listener' }) });
  const message = text => ({ roomId, text, requestId: randomUUID(), userId: 'forged', name: 'Forged' });
  try {
    await sendChat(owner, 'CHAT_MESSAGE', message('  Hello room  '));
    const event = listener.events[0];
    assert.equal(event.payload.text, 'Hello room');
    assert.equal(event.payload.name, 'Host');
    assert.equal(event.payload.userId, 'owner');
    assert.equal(owner.events.length, 1);
    assert.equal(outsider.events.length, 0);
    assert.equal((await getChatHistory(listener, { roomId })).messages.length, 1);
    const wsService = new WebSocketService(createServer());
    await wsService.handleMessage(owner, JSON.stringify({ action: 'CHAT_MESSAGE', payload: message('Through the socket dispatcher') }));
    assert.equal(listener.events.at(-1).payload.text, 'Through the socket dispatcher');
    await wsService.handleMessage(outsider, JSON.stringify({ action: 'CHAT_MESSAGE', payload: message('No access') }));
    assert.equal(outsider.events.at(-1).action, 'CHAT_ERROR');
    await assert.rejects(sendChat(outsider, 'CHAT_MESSAGE', message('No access')));
    await assert.rejects(getChatHistory(outsider, { roomId }));
    // Even a stale socket in the in-memory set cannot bypass database membership.
    session.users.add(outsider);
    await assert.rejects(sendChat(outsider, 'CHAT_MESSAGE', message('No access')));
    await assert.rejects(getChatHistory(outsider, { roomId }));
    await assert.rejects(sendChat(owner, 'CHAT_MESSAGE', message('   ')));
    await assert.rejects(sendChat(owner, 'CHAT_MESSAGE', message('x'.repeat(501))));
    await assert.rejects(sendChat(owner, 'CHAT_REACTION', { roomId, emoji: 'invalid' }));
    await sendChat(listener, 'CHAT_REACTION', { roomId, emoji: '🔥' });
    assert.equal(owner.events.at(-1).action, 'CHAT_REACTION');
    assert.equal((await getChatHistory(owner, { roomId })).messages.length, 2);
    for (let index = 0; index < 3; index++) await sendChat(owner, 'CHAT_MESSAGE', message('Another'));
    await assert.rejects(sendChat(owner, 'CHAT_REACTION', { roomId, emoji: '👏' }), /Slow down/);
    for (let index = 0; index < 105; index++) {
      clock += 5001;
      await sendChat(owner, 'CHAT_MESSAGE', message(`Message ${index}`));
    }
    const history = await getChatHistory(owner, { roomId });
    assert.equal(history.messages.length, 100);
    assert.equal(history.messages.at(-1).text, 'Message 104');
    members = [];
    await assert.rejects(sendChat(listener, 'CHAT_MESSAGE', message('Already left')));
    RoomService.rooms.delete(roomId);
    await assert.rejects(getChatHistory(owner, { roomId }));
    RoomService.rooms.set(roomId, { users: new Set([owner]) });
    assert.deepEqual((await getChatHistory(owner, { roomId })).messages, []);
  } finally {
    Room.findById = originalRoom;
    User.findById = originalUser;
    Date.now = originalNow;
    RoomService.rooms.clear();
  }
});
