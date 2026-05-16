import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

import { createClient, createEmployee, updateUser } from '../controllers/user.js'
import User from '../models/user.js'

const callHandler = async (handler, body, params = {}) => {
    let nextError
    let responseSent = false
    let statusCode
    let jsonBody
    const req = { body, params }
    const res = {
        status: (code) => {
            statusCode = code

            return {
                json: (body) => {
                    jsonBody = body
                    responseSent = true
                },
            }
        },
        json: (body) => {
            jsonBody = body
                responseSent = true
        },
    }

    await handler(req, res, (err) => {
        nextError = err
    })

    return { nextError, responseSent, statusCode, jsonBody }
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

test('updateUser endpoint returns 400 for an invalid user id', async () => {
    const { nextError, responseSent } = await callHandler(updateUser, { firstName: 'Ali' }, { userId: 'invalid-id' })

    assert.equal(responseSent, false)
    assert.equal(nextError.status, 400)
    assert.match(nextError.message, /Invalid user id/)
})

test('updateUser endpoint returns 400 for invalid update fields before database work', async () => {
    const { nextError, responseSent } = await callHandler(
        updateUser,
        {
            username: '',
            phone: 'abc',
            email: 'not-an-email',
        },
        { userId: '64f000000000000000000000' },
    )

    assert.equal(responseSent, false)
    assert.equal(nextError.status, 400)
    assert.match(nextError.message, /Username cannot be empty/)
    assert.match(nextError.message, /Phone must contain 7 to 15 digits/)
    assert.match(nextError.message, /Invalid Email Address/)
})

test('updateUser endpoint updates sanitized editable fields', async (t) => {
    t.after(() => mock.restoreAll())

    const userId = '64f000000000000000000000'
    const updatedUser = {
        _id: userId,
        firstName: 'Ali',
        lastName: 'Khan',
        username: 'ali.khan',
        phone: '+923001234567',
        email: 'ali@example.com',
        role: 'employee',
    }
    let duplicateQuery
    let updateArgs

    mock.method(User, 'findById', async () => ({ _id: userId, role: 'employee' }))
    mock.method(User, 'findOne', async (query) => {
        duplicateQuery = query
        return null
    })
    mock.method(User, 'findByIdAndUpdate', async (...args) => {
        updateArgs = args
        return updatedUser
    })

    const { nextError, responseSent, statusCode, jsonBody } = await callHandler(
        updateUser,
        {
            firstName: ' Ali ',
            phone: '+92 300-1234567',
            email: 'ALI@EXAMPLE.COM',
            role: 'super_admin',
            password: 'should-not-update',
        },
        { userId },
    )

    assert.equal(nextError, undefined)
    assert.equal(responseSent, true)
    assert.equal(statusCode, 200)
    assert.deepEqual(duplicateQuery, {
        $or: [{ phone: '+923001234567' }, { email: 'ali@example.com' }],
        _id: { $ne: userId },
    })
    assert.deepEqual(updateArgs, [
        userId,
        { $set: { firstName: 'Ali', phone: '+923001234567', email: 'ali@example.com' } },
        { new: true, runValidators: true },
    ])
    assert.deepEqual(jsonBody, {
        result: updatedUser,
        message: 'User updated successfully',
        success: true,
    })
})

test('updateUser endpoint rejects duplicate update values', async (t) => {
    t.after(() => mock.restoreAll())

    const userId = '64f000000000000000000000'

    mock.method(User, 'findById', async () => ({ _id: userId, role: 'employee' }))
    mock.method(User, 'findOne', async () => ({ _id: '64f000000000000000000001', phone: '03001234567' }))
    mock.method(User, 'findByIdAndUpdate', async () => {
        throw new Error('findByIdAndUpdate should not be called')
    })

    const { nextError, responseSent } = await callHandler(
        updateUser,
        { phone: '03001234567' },
        { userId },
    )

    assert.equal(responseSent, false)
    assert.equal(nextError.status, 400)
    assert.match(nextError.message, /Phone already exist/)
})

test('updateUser endpoint returns 400 when the user does not exist', async (t) => {
    t.after(() => mock.restoreAll())

    const userId = '64f000000000000000000000'

    mock.method(User, 'findById', async () => null)
    mock.method(User, 'findOne', async () => {
        throw new Error('findOne should not be called')
    })
    mock.method(User, 'findByIdAndUpdate', async () => {
        throw new Error('findByIdAndUpdate should not be called')
    })

    const { nextError, responseSent } = await callHandler(
        updateUser,
        { firstName: 'Ali' },
        { userId },
    )

    assert.equal(responseSent, false)
    assert.equal(nextError.status, 400)
    assert.match(nextError.message, /User not exist/)
})
