import validator from 'validator'

const phonePattern = /^\+?\d{7,15}$/
const cnicPattern = /^\d{5}-?\d{7}-?\d$/
const usernamePattern = /^[a-zA-Z0-9_.-]+$/
const updateUserFields = ['firstName', 'lastName', 'username', 'phone', 'city', 'CNIC', 'email']

const normalizeInput = (value) => value === undefined || value === null ? '' : String(value).trim()

export const normalizeUserPayload = (body = {}) => ({
    firstName: normalizeInput(body.firstName),
    lastName: normalizeInput(body.lastName),
    username: normalizeInput(body.username),
    phone: normalizeInput(body.phone).replace(/[\s-]/g, ''),
    city: normalizeInput(body.city),
    CNIC: normalizeInput(body.CNIC),
    email: normalizeInput(body.email).toLowerCase(),
    password: normalizeInput(body.password),
})

const normalizeUpdateUserPayload = (body = {}) => {
    const payload = {}

    updateUserFields.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(body, field)) return

        if (field === 'phone') {
            payload[field] = normalizeInput(body[field]).replace(/[\s-]/g, '')
        } else if (field === 'email') {
            payload[field] = normalizeInput(body[field]).toLowerCase()
        } else {
            payload[field] = normalizeInput(body[field])
        }
    })

    return payload
}

const validateUserPayload = (payload, requiredFields, validatePassword = false, nonEmptyFields = []) => {
    const fieldLabels = {
        firstName: 'First name',
        lastName: 'Last name',
        username: 'Username',
        phone: 'Phone',
        password: 'Password',
    }
    const errors = []

    requiredFields.forEach((field) => {
        if (!payload[field]) errors.push(`${fieldLabels[field] || field} is required`)
    })

    nonEmptyFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field) && !payload[field]) {
            errors.push(`${fieldLabels[field] || field} cannot be empty`)
        }
    })

    if (payload.firstName && !validator.isLength(payload.firstName, { max: 50 })) {
        errors.push('First name must be 50 characters or fewer')
    }
    if (payload.lastName && !validator.isLength(payload.lastName, { max: 50 })) {
        errors.push('Last name must be 50 characters or fewer')
    }
    if (payload.username && !validator.isLength(payload.username, { min: 3, max: 30 })) {
        errors.push('Username must be between 3 and 30 characters')
    }
    if (payload.username && !usernamePattern.test(payload.username)) {
        errors.push('Username can only contain letters, numbers, underscores, periods, and hyphens')
    }
    if (payload.phone && !phonePattern.test(payload.phone)) {
        errors.push('Phone must contain 7 to 15 digits and may start with +')
    }
    if (payload.email && !validator.isEmail(payload.email)) {
        errors.push('Invalid Email Address')
    }
    if (payload.CNIC && !cnicPattern.test(payload.CNIC)) {
        errors.push('CNIC must be 13 digits, with optional dashes')
    }
    if (validatePassword && payload.password && !validator.isLength(payload.password, { min: 6, max: 128 })) {
        errors.push('Password must be between 6 and 128 characters')
    }

    return errors
}

export const validateCreateClientPayload = (body = {}) => {
    const payload = normalizeUserPayload(body)
    const errors = validateUserPayload(payload, ['firstName', 'lastName', 'username', 'phone'])

    return { payload, errors }
}

export const validateCreateEmployeePayload = (body = {}) => {
    const payload = normalizeUserPayload(body)
    const errors = validateUserPayload(payload, ['firstName', 'lastName', 'username', 'phone', 'password'], true)

    return { payload, errors }
}

export const validateUpdateUserPayload = (body = {}) => {
    const payload = normalizeUpdateUserPayload(body)
    const errors = validateUserPayload(payload, [], false, ['firstName', 'lastName', 'username', 'phone'])

    if (!Object.keys(payload).length) {
        errors.unshift('At least one valid user field is required to update')
    }

    return { payload, errors }
}

export const getDuplicateUserQuery = (payload) => {
    const duplicateConditions = []

    if (payload.username) duplicateConditions.push({ username: payload.username })
    if (payload.phone) duplicateConditions.push({ phone: payload.phone })
    if (payload.email) duplicateConditions.push({ email: payload.email })

    if (!duplicateConditions.length) return null

    return { $or: duplicateConditions }
}

export const getDuplicateUserQueryExcludingId = (payload, userId) => {
    const duplicateUserQuery = getDuplicateUserQuery(payload)

    if (!duplicateUserQuery) return null

    return { ...duplicateUserQuery, _id: { $ne: userId } }
}

export const getDuplicateUserMessage = (existingUser, payload) => {
    if (!existingUser) return null
    if (payload.username && existingUser.username === payload.username) return 'Username already exist'
    if (payload.phone && existingUser.phone === payload.phone) return 'Phone already exist'
    if (payload.email && existingUser.email === payload.email) return 'Email already exist'
    return 'User already exist'
}
