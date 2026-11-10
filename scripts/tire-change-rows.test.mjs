import test from 'node:test'
import assert from 'node:assert/strict'
import { pairTireChanges, primaryEvent } from '../src/lib/tire-change-rows.ts'

const ev = (id, event_type, position_code, event_date = '2026-11-10', vehicle_id = 'v1') => ({ id, event_type, position_code, event_date, vehicle_id })
const byVehicle = (e) => e.vehicle_id

test('ถอด+ใส่ ตำแหน่งเดียวกัน วันเดียวกัน = 1 แถว (ลำดับ mount มาก่อน unmount)', () => {
  const rows = pairTireChanges([ev('m1', 'mount', 'FL'), ev('u1', 'unmount', 'FL')], byVehicle)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].mount.id, 'm1')
  assert.equal(rows[0].unmount.id, 'u1')
  assert.equal(rows[0].key, 'm1')
  assert.equal(primaryEvent(rows[0]).id, 'm1')
})

test('คนละตำแหน่ง / คนละวัน / คนละคัน ไม่จับคู่', () => {
  const rows = pairTireChanges([
    ev('m1', 'mount', 'FL'), ev('u1', 'unmount', 'FR'),
    ev('m2', 'mount', 'RL', '2026-11-09'), ev('u2', 'unmount', 'RL', '2026-11-08'),
    ev('m3', 'mount', 'RR', '2026-11-07', 'v1'), ev('u3', 'unmount', 'RR', '2026-11-07', 'v2'),
  ], byVehicle)
  assert.equal(rows.length, 6)
})

test('ถอดอย่างเดียว / ใส่อย่างเดียว ได้แถวฝั่งเดียว', () => {
  const rows = pairTireChanges([ev('u1', 'unmount', 'FL'), ev('m1', 'mount', 'FR')], byVehicle)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].mount, null); assert.equal(rows[0].unmount.id, 'u1')
  assert.equal(rows[1].unmount, null); assert.equal(primaryEvent(rows[1]).id, 'm1')
})

test('เปลี่ยน 2 ครั้งตำแหน่งเดียวกันวันเดียวกัน จับคู่ตามลำดับ ไม่ซ้อนกัน', () => {
  const rows = pairTireChanges([ev('m2', 'mount', 'FL'), ev('u2', 'unmount', 'FL'), ev('m1', 'mount', 'FL'), ev('u1', 'unmount', 'FL')], byVehicle)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((r) => [r.unmount.id, r.mount.id]), [['u2', 'm2'], ['u1', 'm1']])
})

test('ไม่มีตำแหน่ง = แถวเดี่ยวเสมอ', () => {
  const rows = pairTireChanges([ev('m1', 'mount', null), ev('u1', 'unmount', null)], byVehicle)
  assert.equal(rows.length, 2)
})
