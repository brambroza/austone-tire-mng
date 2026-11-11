import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AUSTONE_TEAM_ASSIGNABLE_ROLES, ROLE_LABEL, SHOP_STAFF_ASSIGNABLE_ROLES,
  canEditCentral, canManageAustoneTeam, canManageDealers, isAustoneStaff, isShopAdmin, isShopStaff,
} from '../src/lib/roles.ts'

const ALL = ['super_admin', 'austone_admin', 'sales', 'admin', 'technician', 'shop', 'shop_technician']

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
  for (const r of ['admin', 'technician', 'shop', 'shop_technician']) {
    assert.equal(isAustoneStaff(r), false)
    assert.equal(canEditCentral(r), false)
    assert.equal(canManageDealers(r), false)
  }
})

test('super admin can only assign austone_admin or sales from the team page', () => {
  assert.deepEqual([...AUSTONE_TEAM_ASSIGNABLE_ROLES], ['austone_admin', 'sales'])
})

test('shop admin and shop technician both enter /shop; only shop admin manages customers/reports/staff', () => {
  assert.deepEqual(ALL.filter(isShopStaff), ['shop', 'shop_technician'])
  assert.deepEqual(ALL.filter(isShopAdmin), ['shop'])
  assert.equal(isShopAdmin('shop_technician'), false)
  assert.equal(isShopStaff('technician'), false)
})

test('shop staff roles assignable from staff pages are exactly the two shop levels, each with a Thai label', () => {
  assert.deepEqual([...SHOP_STAFF_ASSIGNABLE_ROLES], ['shop', 'shop_technician'])
  for (const r of ALL) assert.ok(ROLE_LABEL[r], `missing label for ${r}`)
})
