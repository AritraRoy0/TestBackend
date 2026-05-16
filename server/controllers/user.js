import User from '../models/user.js'
import Lead from '../models/lead.js'
import { createError } from '../utils/error.js'
import bcrypt from 'bcryptjs'
import validator from 'validator'


export const getUsers = async (req, res, next) => {
    try {

        const users = await User.find()
        res.status(200).json({ result: users, message: 'users fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))

    }
}

export const getUser = async (req, res, next) => {
    try {

        const { userId } = req.params
        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(401, 'User not exist'))

        res.status(200).json({ result: findedUser, message: 'user fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))

    }
}

export const filterUser = async (req, res, next) => {
    const { startingDate, endingDate, ...filters } = req.query;
    try {
        let query = await User.find(filters)

        // Check if startingDate is provided and valid
        if (startingDate && isValidDate(startingDate)) {
            const startDate = new Date(startingDate);
            startDate.setHours(0, 0, 0, 0);

            // Add createdAt filtering for startingDate
            query = query.where('createdAt').gte(startDate);
        }

        // Check if endingDate is provided and valid
        if (endingDate && isValidDate(endingDate)) {
            const endDate = new Date(endingDate);
            endDate.setHours(23, 59, 59, 999);

            // Add createdAt filtering for endingDate
            if (query.model.modelName === 'User') { // Check if the query has not been executed yet
                query = query.where('createdAt').lte(endDate);
            }
        }
        if (query.length > 0) {
            query = await query.populate('userId').exec();
        }
        res.status(200).json({ result: query });

    } catch (error) {
        next(createError(500, error.message));
    }
};


export const getClients = async (req, res, next) => {
    try {

        const findedClients = await User.find({ role: 'client' })
        res.status(200).json({ result: findedClients, message: 'clients fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))

    }
}

export const getEmployeeClients = async (req, res, next) => {
    try {
        let allClients = await User.find({ role: 'client' })
        const employeeLeads = await Lead.find({ allocatedTo: { $in: req.user?._id }, isArchived: false })

        // Filter clients based on the condition
        allClients = allClients.filter((client) => {
            return employeeLeads.findIndex(lead => lead.clientPhone.toString() === client.phone.toString()) !== -1
        });

        res.status(200).json({ result: allClients, message: 'clients fetched successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getEmployees = async (req, res, next) => {
    try {

        const findedEmployees = await User.find({ role: 'employee' })
        res.status(200).json({ result: findedEmployees, message: 'employees fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

const phonePattern = /^\+?\d{7,15}$/
const cnicPattern = /^\d{5}-?\d{7}-?\d$/
const usernamePattern = /^[a-zA-Z0-9_.-]+$/

const normalizeInput = (value) => value === undefined || value === null ? '' : String(value).trim()

const normalizeUserPayload = (body = {}) => ({
    firstName: normalizeInput(body.firstName),
    lastName: normalizeInput(body.lastName),
    username: normalizeInput(body.username),
    phone: normalizeInput(body.phone).replace(/[\s-]/g, ''),
    city: normalizeInput(body.city),
    CNIC: normalizeInput(body.CNIC),
    email: normalizeInput(body.email).toLowerCase(),
    password: normalizeInput(body.password),
})

const validateUserPayload = (payload, requiredFields, validatePassword = false) => {
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

const getDuplicateUserMessage = (existingUser, payload) => {
    if (!existingUser) return null
    if (existingUser.username === payload.username) return 'Username already exist'
    if (existingUser.phone === payload.phone) return 'Phone already exist'
    if (payload.email && existingUser.email === payload.email) return 'Email already exist'
    return 'User already exist'
}

const findDuplicateUser = (payload) => {
    const duplicateConditions = [
        { username: payload.username },
        { phone: payload.phone },
    ]

    if (payload.email) duplicateConditions.push({ email: payload.email })

    return User.findOne({ $or: duplicateConditions })
}

export const createClient = async (req, res, next) => {
    try {
        const payload = normalizeUserPayload(req.body)
        const validationErrors = validateUserPayload(payload, ['firstName', 'lastName', 'username', 'phone'])

        if (validationErrors.length) return next(createError(400, validationErrors.join(', ')))

        const findedUser = await findDuplicateUser(payload)
        const duplicateMessage = getDuplicateUserMessage(findedUser, payload)
        if (duplicateMessage) return next(createError(400, duplicateMessage))

        const { password, ...clientPayload } = payload
        const result = await User.create({ ...clientPayload, role: 'client' })
        res.status(200).json({ result, message: 'client created seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}
export const createEmployee = async (req, res, next) => {
    try {
        const payload = normalizeUserPayload(req.body)
        const validationErrors = validateUserPayload(payload, ['firstName', 'lastName', 'username', 'phone', 'password'], true)

        if (validationErrors.length) return next(createError(400, validationErrors.join(', ')))

        const findedUser = await findDuplicateUser(payload)
        const duplicateMessage = getDuplicateUserMessage(findedUser, payload)
        if (duplicateMessage) return next(createError(400, duplicateMessage))

        const hashedPassword = await bcrypt.hash(payload.password, 12)
        const { password, ...employeePayload } = payload

        const result = await User.create({ ...employeePayload, password: hashedPassword, role: 'employee' })
        res.status(200).json({ result, message: 'employee created seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const updateRole = async (req, res, next) => {
    try {

        const { userId } = req.params
        const { role } = req.body

        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(401, 'User not exist'))

        const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true })
        res.status(200).json({ reuslt: updatedUser, message: 'Role updated successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params
        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(400, 'User not exist'))

        const deletedUser = await User.findByIdAndDelete(userId)
        res.status(200).json({ result: deletedUser, message: 'User deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteWholeCollection = async (req, res, next) => {
    try {

        const result = await User.deleteMany()
        res.status(200).json({ result, message: 'User collection deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}
