import '@testing-library/jest-dom'

// Polyfill crypto.randomUUID for Node.js < 19
if (!global.crypto) {
  global.crypto = {}
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

// Mock Next.js navigation hooks BEFORE any imports
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: '/test',
    query: {},
    asPath: '/test'
  })),
  usePathname: jest.fn(() => '/test'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
  notFound: jest.fn(),
  redirect: jest.fn()
}))

// Mock external dependencies first (before any imports)
jest.mock('@instantdb/react', () => ({
  init: jest.fn(() => ({
    transact: jest.fn(),
    query: jest.fn(() => ({
      data: {},
      isLoading: false,
      error: null
    })),
    useQuery: jest.fn(() => ({
      data: {},
      isLoading: false,
      error: null
    }))
  })),
  i: {
    schema: jest.fn(() => ({})),
    entity: jest.fn(() => ({})),
    string: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    number: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    boolean: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    json: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    any: jest.fn(() => ({ optional: jest.fn(() => ({})) }))
  }
}))

jest.mock('@instantdb/core', () => ({
  init: jest.fn(() => ({
    transact: jest.fn(),
    query: jest.fn(() => Promise.resolve({ data: {} })),
    tx: new Proxy({}, {
      get(target, entityName) {
        return new Proxy({}, {
          get(target, id) {
            return {
              update: jest.fn().mockReturnValue({
                entity: entityName,
                id,
                operation: 'update'
              }),
              delete: jest.fn().mockReturnValue({
                entity: entityName,
                id,
                operation: 'delete'
              })
            }
          }
        })
      }
    })
  })),
  id: jest.fn(() => 'generated-id-123'),
  i: {
    schema: jest.fn(() => ({})),
    entity: jest.fn(() => ({})),
    string: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    number: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    boolean: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    json: jest.fn(() => ({ optional: jest.fn(() => ({})) })),
    any: jest.fn(() => ({ optional: jest.fn(() => ({})) }))
  }
}))

// Create proper OpenAI mock with APIError
const createOpenAIMock = () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{
            message: { content: 'Mock AI response' }
          }]
        }))
      }
    },
    embeddings: {
      create: jest.fn(() => Promise.resolve({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      }))
    }
  }))

  // Add APIError as a static property
  MockOpenAI.APIError = class APIError extends Error {
    constructor(message, status, headers) {
      super(message)
      this.name = 'APIError'
      this.status = status
      this.headers = headers
    }
  }

  return MockOpenAI
}

const OpenAIMock = createOpenAIMock()

jest.mock('openai', () => ({
  __esModule: true,
  default: OpenAIMock,
  OpenAI: OpenAIMock
}))

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(() => Promise.resolve({}))
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn()
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() => Promise.resolve('https://mock-presigned-url.com'))
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Promise.resolve(Buffer.from('mock file content'))),
  writeFile: jest.fn(() => Promise.resolve()),
  access: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({
    size: 1024,
    isFile: () => true,
    isDirectory: () => false,
    mtime: new Date(),
    birthtime: new Date()
  })),
  unlink: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve())
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  createReadStream: jest.fn(() => ({
    pipe: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn()
  }))
}))

jest.mock('path', () => ({
  join: jest.fn((...paths) => paths.join('/')),
  resolve: jest.fn((...paths) => '/' + paths.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn((p) => '.' + p.split('.').pop()),
  normalize: jest.fn((p) => p),
  relative: jest.fn(() => 'relative/path')
}))

// Mock IntersectionObserver for components that might use it
// Mock Element.scrollIntoView for tests
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn()
}
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia for responsive design tests (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock window.scrollTo for tests (only in jsdom environment)
if (typeof global.scrollTo === 'undefined') {
  global.scrollTo = jest.fn()
}

// Suppress console.log in tests unless VERBOSE_TESTS is set
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }
}

// Mock Service Worker for PWA tests (only in browser environment)
if (typeof navigator !== 'undefined' && navigator) {
  global.navigator.serviceWorker = {
    register: jest.fn(() => Promise.resolve()),
    ready: Promise.resolve({
      unregister: jest.fn(() => Promise.resolve()),
    }),
  }
}

// Set up fake timers by default (can be overridden in individual tests)
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

// Mock ReadableStream for file streaming
global.ReadableStream = class MockReadableStream {
  constructor(underlyingSource = {}) {
    this.underlyingSource = underlyingSource
    this.locked = false
    this.controller = {
      enqueue: jest.fn(),
      close: jest.fn(),
      error: jest.fn()
    }
  }

  getReader() {
    this.locked = true
    return {
      read: jest.fn(() => Promise.resolve({ done: true, value: undefined })),
      releaseLock: jest.fn(() => { this.locked = false }),
      closed: Promise.resolve()
    }
  }

  pipeTo(dest) {
    return Promise.resolve()
  }

  pipeThrough(transform) {
    return new MockReadableStream()
  }
}

// Mock TransformStream for data processing
global.TransformStream = class MockTransformStream {
  constructor(transformer = {}) {
    this.transformer = transformer
    this.readable = new ReadableStream()
    this.writable = {
      getWriter: () => ({
        write: jest.fn(() => Promise.resolve()),
        close: jest.fn(() => Promise.resolve()),
        abort: jest.fn(() => Promise.resolve())
      })
    }
  }
}

// Mock Web APIs for Edge Runtime compatibility - only if not already defined
if (typeof global.Request === 'undefined') {
  global.Request = class MockRequest {
    constructor(input, init = {}) {
      this._url = typeof input === 'string' ? input : input.url
      this.method = init.method || 'GET'
      this.headers = new Map(Object.entries(init.headers || {}))
      this._body = init.body
      this.bodyUsed = false
    }

    get url() {
      return this._url
    }

    async json() {
      if (this.bodyUsed) throw new Error('Body already used')
      this.bodyUsed = true
      return JSON.parse(this._body)
    }

    async text() {
      if (this.bodyUsed) throw new Error('Body already used')
      this.bodyUsed = true
      return this._body
    }

    async formData() {
      if (this.bodyUsed) throw new Error('Body already used')
      this.bodyUsed = true
      const formData = new FormData()
      formData.append('test', 'data')
      return formData
    }

    async arrayBuffer() {
      if (this.bodyUsed) throw new Error('Body already used')
      this.bodyUsed = true
      return new ArrayBuffer(8)
    }
  }
}

global.Response = class MockResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Map(Object.entries(init.headers || {}))
    this.ok = this.status >= 200 && this.status < 300
  }

  static json(data, init) {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
    })
  }

  async json() {
    return JSON.parse(this.body)
  }

  async text() {
    return this.body
  }

  async arrayBuffer() {
    const encoder = new TextEncoder()
    return encoder.encode(this.body).buffer
  }
}

// Mock File API
global.File = class MockFile {
  constructor(bits, name, options = {}) {
    this.name = name
    this.size = bits.reduce((acc, bit) => acc + bit.length, 0)
    this.type = options.type || ''
    this.lastModified = options.lastModified || Date.now()
    this._bits = bits
  }

  async arrayBuffer() {
    const encoder = new TextEncoder()
    return encoder.encode(this._bits.join('')).buffer
  }

  async text() {
    return this._bits.join('')
  }

  stream() {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(this._bits.join('')))
        controller.close()
      }
    })
  }
}

global.Blob = class MockBlob {
  constructor(blobParts = [], options = {}) {
    this.size = blobParts.reduce((acc, part) => acc + part.length, 0)
    this.type = options.type || ''
    this._parts = blobParts
  }

  async arrayBuffer() {
    const encoder = new TextEncoder()
    return encoder.encode(this._parts.join('')).buffer
  }

  async text() {
    return this._parts.join('')
  }

  stream() {
    return new ReadableStream({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode(this._parts.join('')))
        controller.close()
      }
    })
  }
}

// Mock FormData
global.FormData = class MockFormData {
  constructor() {
    this._data = new Map()
  }

  append(name, value, filename) {
    if (!this._data.has(name)) {
      this._data.set(name, [])
    }
    this._data.get(name).push({ value, filename })
  }

  get(name) {
    const values = this._data.get(name)
    return values ? values[0].value : null
  }

  getAll(name) {
    const values = this._data.get(name)
    return values ? values.map(v => v.value) : []
  }

  has(name) {
    return this._data.has(name)
  }

  entries() {
    const entries = []
    for (const [key, values] of this._data) {
      for (const { value } of values) {
        entries.push([key, value])
      }
    }
    return entries[Symbol.iterator]()
  }
}

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks()
})
