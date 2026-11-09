import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AUSTONE_TEAM_ASSIGNABLE_ROLES, canEditCentral, canManageAustoneTeam, canManageDealers, isAustoneStaff,
} from '../src/lib/roles.ts'

const ALL = ['super_admin', 'austone_admin', 'sales', 'admin', 'technician', 'shop']

test('only Austone roles enter /superadmin', () => {
  assert.deepEqual(ALL.filter(isAustoneStaff), ['super_admin', 'austone_admin', 'sales'])
})

test('sales cannot edit central data but can manage dealers', () => {
  assert.equal(canEditCentral('sales'), false)
  assert.equal(canManageDealers('sales'), true)
  assert.equal(canManageAustoneTeam('sales'), false)
})

test('austone_admin edits everything except the Austone team', () => {
  assert.equal(canEditCentral('austone_admin'), true)
  assert.equal(canManageDealers('austone_admin'), true)
  assert.equal(canManageAustoneTeam('austone_admin'), false)
})

test('super_admin can do everything; tenant roles nothing on the Austone side', () => {
  assert.equal(canManageAustoneTeam('super_admin'), true)
  assert.equal(canEditCentral('super_admin'), true)
  for (const r of ['admin', 'technician', 'shop']) {
    assert.equal(isAustoneStaff(r), false)
    assert.equal(canEditCentral(r), false)
    assert.equal(canManageDealers(r), false)
  }
})

test('super admin can only assign austone_admin or sales from the team page', () => {
  assert.deepEqual([...AUSTONE_TEAM_ASSIGNABLE_ROLES], ['austone_admin', 'sales'])
})
