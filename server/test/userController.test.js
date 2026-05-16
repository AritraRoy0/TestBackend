import test from 'node:test'
import assert from 'node:assert/strict'

import { createClient, createEmployee } from '../controllers/user.js'

const callHandler = async (handler, body) => {
    let nextError
    let responseSent = false
    const req = { body }
    const res = {
        status: () => ({
            json: () => {
                responseSent = true
            },
        }),
    }

    await handler(req, res, (err) => {
        nextError = err
    })

    return { nextError, responseSent }
}

test('createClient endpoint returns 400 for invalid client fields', async () => {
    const { nextError, responseSent } = await callHandler(createClient, {
        firstName: '',
        lastName: 'Khan',
        username: 'ab',
        phone: 'abc',
        email: 'not-an-email',
    })

    assert.equal(responseSent, false)
    assert.equal(nextError.status, 400)
    assert.match(nextError.message, /First name is required/)
    assert.match(nextError.message, /Username must be between 3 and 30 characters/)
    assert.match(nextError.message, /Phone must contain 7 to 15 digits/)
    assert.match(nextError.message, /Invalid Email Address/)
})

test('createEmployee endpoint returns 400 for invalid employee fields', async () => {
    const { nextError, responseSent } = await callHandler(createEmployee, {
        firstName: 'Ali',
        lastName: 'Khan',
        username: 'ali.khan',
        phone: '03001234567',
        password: '12345',
    })

    assert.equal(responseSent, false)
    assert.equal(nextError.status, 400)
    assert.match(nextError.message, /Password must be between 6 and 128 characters/)
})
