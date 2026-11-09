import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PUBLIC_TOKEN_LENGTH, generatePublicToken, isPublicTokenFormat, publicHistoryPath, publicHistoryUrl,
} from '../src/lib/public-link.ts'

test('generated token is 32 base64url chars and passes the format check', () => {
  const token = generatePublicToken()
  assert.equal(token.length, PUBLIC_TOKEN_LENGTH)
  assert.ok(isPublicTokenFormat(token))
  assert.doesNotMatch(token, /[+/=]/)
})

test('two tokens differ and deterministic fill is reproducible', () => {
  assert.notEqual(generatePublicToken(), generatePublicToken())
  const fill = (bytes) => bytes.fill(255)
  assert.equal(generatePublicToken(fill), '_'.repeat(32))
  assert.equal(generatePublicToken((b) => b.fill(0)), 'A'.repeat(32))
})

test('format check rejects short, long, non-base64url and empty tokens', () => {
  assert.equal(isPublicTokenFormat('abc'), false)
  assert.equal(isPublicTokenFormat('A'.repeat(33)), false)
  assert.equal(isPublicTokenFormat('A'.repeat(31) + '+'), false)
  assert.equal(isPublicTokenFormat(''), false)
  assert.equal(isPublicTokenFormat(null), false)
  assert.equal(isPublicTokenFormat(undefined), false)
})

test('public URL joins base and path without double slashes', () => {
  const token = 'A'.repeat(32)
  assert.equal(publicHistoryPath(token), `/p/${token}`)
  assert.equal(publicHistoryUrl('https://tire.example.com/', token), `https://tire.example.com/p/${token}`)
  assert.equal(publicHistoryUrl('http://localhost:3000', token), `http://localhost:3000/p/${token}`)
})
