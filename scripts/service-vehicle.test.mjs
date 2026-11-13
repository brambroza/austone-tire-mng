import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SERVICE_VEHICLE_INACTIVE_MESSAGE, SERVICE_VEHICLE_NOT_FOUND_MESSAGE, planServiceVehicle,
} from '../src/lib/service-vehicle.ts'

const active = (axle_type) => ({ axle_type, is_active: true })

test('typed plate not in the system is created only at confirm time', () => {
  assert.deepEqual(
    planServiceVehicle({ existing: null, axleType: '6W', mountedCount: 0 }),
    { kind: 'create' },
  )
})

test('picked vehicle id that no longer exists is an error, never a create', () => {
  assert.deepEqual(
    planServiceVehicle({ requestedVehicleId: 'v1', existing: null, axleType: '6W', mountedCount: 0 }),
    { kind: 'error', error: SERVICE_VEHICLE_NOT_FOUND_MESSAGE },
  )
})

test('inactive vehicle is rejected', () => {
  assert.deepEqual(
    planServiceVehicle({ existing: { axle_type: '6W', is_active: false }, axleType: '6W', mountedCount: 0 }),
    { kind: 'error', error: SERVICE_VEHICLE_INACTIVE_MESSAGE },
  )
})

test('same axle type needs no write', () => {
  assert.deepEqual(
    planServiceVehicle({ existing: active('6W'), axleType: '6W', mountedCount: 4 }),
    { kind: 'use' },
  )
})

test('changing axle type keeps the previous type so a failed save can restore it', () => {
  assert.deepEqual(
    planServiceVehicle({ existing: active('6W'), axleType: '10W', mountedCount: 0 }),
    { kind: 'change_type', previousAxleType: '6W' },
  )
})

test('changing axle type with mounted tyres is blocked', () => {
  const plan = planServiceVehicle({ existing: active('6W'), axleType: '10W', mountedCount: 3 })
  assert.equal(plan.kind, 'error')
  assert.match(plan.error, /มียางติดตั้งอยู่ 3 เส้น/)
})
