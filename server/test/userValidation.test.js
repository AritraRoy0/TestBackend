import test from 'node:test'
import assert from 'node:assert/strict'

import {
    getDuplicateUserMessage,
    getDuplicateUserQuery,
    validateCreateClientPayload,
    validateCreateEmployeePayload,
} from '../utils/userValidation.js'

const validClient = {
    firstName: 'Ali',
    lastName: 'Khan',
    username: 'ali.khan',
    phone: '03001234567',
    email: 'ali@example.com',
}

test('createClient validation accepts valid input and normalizes strings', () => {
    const { payload, errors } = validateCreateClientPayload({
        firstName: '  Ali  ',
        lastName: ' Khan ',
        username: ' ali.khan ',
        phone: '+92 300-1234567',
        email: 'ALI@EXAMPLE.COM ',
        CNIC: '12345-1234567-1',
    })

    assert.deepEqual(errors, [])
    assert.equal(payload.firstName, 'Ali')
    assert.equal(payload.lastName, 'Khan')
    assert.equal(payload.username, 'ali.khan')
    assert.equal(payload.phone, '+923001234567')
    assert.equal(payload.email, 'ali@example.com')
})

test('createClient validation rejects missing and malformed fields', () => {
    const { errors } = validateCreateClientPayload({
        firstName: ' ',
        lastName: 'Khan',
        username: 'ab',
        phone: 'abc',
        email: 'not-an-email',
        CNIC: '123',
    })

    assert.ok(errors.includes('First name is required'))
    assert.ok(errors.includes('Username must be between 3 and 30 characters'))
    assert.ok(errors.includes('Phone must contain 7 to 15 digits and may start with +'))
    assert.ok(errors.includes('Invalid Email Address'))
    assert.ok(errors.includes('CNIC must be 13 digits, with optional dashes'))
})

test('createEmployee validation requires and validates password', () => {
    const missingPassword = validateCreateEmployeePayload(validClient)
    const shortPassword = validateCreateEmployeePayload({ ...validClient, password: '12345' })
    const validEmployee = validateCreateEmployeePayload({ ...validClient, password: '123456' })

    assert.ok(missingPassword.errors.includes('Password is required'))
    assert.ok(shortPassword.errors.includes('Password must be between 6 and 128 characters'))
    assert.deepEqual(validEmployee.errors, [])
})

test('createClient validation does not require password', () => {
    const { errors } = validateCreateClientPayload(validClient)

    assert.deepEqual(errors, [])
})

test('duplicate user query checks username and phone, and only checks email when provided', () => {
    assert.deepEqual(
        getDuplicateUserQuery({ username: 'ali.khan', phone: '03001234567', email: '' }),
        { $or: [{ username: 'ali.khan' }, { phone: '03001234567' }] },
    )

    assert.deepEqual(
        getDuplicateUserQuery({ username: 'ali.khan', phone: '03001234567', email: 'ali@example.com' }),
        { $or: [{ username: 'ali.khan' }, { phone: '03001234567' }, { email: 'ali@example.com' }] },
    )
})

test('duplicate user message reports the matching field', () => {
    const payload = {
        username: 'ali.khan',
        phone: '03001234567',
        email: 'ali@example.com',
    }

    assert.equal(getDuplicateUserMessage({ username: payload.username }, payload), 'Username already exist')
    assert.equal(getDuplicateUserMessage({ phone: payload.phone }, payload), 'Phone already exist')
    assert.equal(getDuplicateUserMessage({ email: payload.email }, payload), 'Email already exist')
    assert.equal(getDuplicateUserMessage(null, payload), null)
})
