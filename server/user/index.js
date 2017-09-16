'use strict'

const serie = require('fastseries')()

const {
  login: loginSchema,
  registration: registrationSchema
} = require('./schemas')
const UserService = require('./UserService')

function registerEnv (data, done) {
  const envOpts = {
    schema: {
      type: 'object',
      required: [ 'USER_MONGO_URL', 'JWT_SECRET' ],
      properties: {
        USER_MONGO_URL: { type: 'string', default: 'mongodb://localhost/user' },
        JWT_SECRET: { type: 'string', default: 'changeme!' }
      }
    },
    data: data
  }
  this.register(require('fastify-env'), envOpts, done)
}

function registerMongo (a, done) {
  const mongoDbOpts = {
    url: this.config.USER_MONGO_URL
  }
  this.register(require('fastify-mongodb'), mongoDbOpts, done)
}

function decorateWithUserCollection (a, done) {
  this.decorate('userCollection', this.mongo.db.collection('users'))
  done()
}

function registerJwt (a, done) {
  const jwtOpts = {
    secret: this.config.JWT_SECRET,
    algorithms: ['RS256']
  }
  this.register(require('fastify-jwt'), jwtOpts, done)
}

function registerMongoSetup (a, done) {
  this.register(require('./mongoCollectionSetup'), done)
}

function decorateWithUserService (a, done) {
  const userService = new UserService(this.userCollection, this.jwt)
  this.decorate('userService', userService)
  done()
}

function registerRoutes (a, done) {
  const { userService } = this
  this.post('/api/login', loginSchema, async function (req, reply) {
    const { username, password } = req.body
    const jwt = await userService.login(username, password)

    return {jwt}
  })

  this.post('/api/register', registrationSchema, async function (req, reply) {
    const { username, password } = req.body
    await userService.register(username, password)
    return {}
  })

  this.get('/api/me', async function (req, reply) {
    const jwt = (req.req.headers.authorization || '').substr(7)
    const user = await userService.me(jwt)
    return user
  })

  done()
}

module.exports = function (fastify, opts, next) {
  serie(
    fastify,
    [
      registerEnv,
      registerMongo,
      decorateWithUserCollection,
      registerJwt,
      registerMongoSetup,
      decorateWithUserService,
      registerRoutes
    ],
    opts,
    next
  )
}
