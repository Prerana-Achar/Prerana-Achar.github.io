// The three recognition networks on onnxruntime-web, behind the two calls the Python side
// needs (see py/ort_shim.py). Runs inside the recognition worker using WebAssembly JSPI.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/'
const MODELS = ['segnet', 'encoder', 'decoder']

let ort
const sessions = {}
const kept = new Map() // outputs which stay here: the decoder's cache, fed back in each step

/** Fetch with byte progress, kept in the Cache API so that it downloads once. */
export async function cached(url, onBytes = () => {}) {
  // Recognition still works when private browsing or quota settings deny storage.
  const cache = await globalThis.caches?.open('cadence-omr-assets-v1').catch(() => null)
  let res = await cache?.match(url)
  if (!res) {
    res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    const total = +res.headers.get('content-length') || 0
    const reader = res.body.getReader()
    const chunks = []
    for (let got = 0; ;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      onBytes((got += value.length), total)
    }
    const blob = new Blob(chunks)
    await cache?.put(url, new Response(blob)).catch(() => {})
    return blob.arrayBuffer()
  }
  return res.arrayBuffer()
}

/** Download the models from `base` and start them. onProgress(bytes done, bytes in all). */
export async function load(base, onProgress) {
  ort = await import(/* @vite-ignore */ ORT + 'ort.wasm.min.mjs')
  ort.env.wasm.wasmPaths = ORT
  // Threads need shared memory; phones get fewer, each costs memory.
  // GitHub Pages does not provide the isolation headers required for threads.
  ort.env.wasm.numThreads = 1
  const progress = {}
  await Promise.all(MODELS.map(async (name) => {
    const bytes = await cached(`${base}models/${name}.onnx`, (got, total) => {
      progress[name] = [got, total]
      const sum = (i) => Object.values(progress).reduce((s, p) => s + p[i], 0)
      onProgress(sum(0), sum(1))
    })
    // Single-threaded WASM works without cross-origin isolation headers.
    sessions[name] = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })
  }))
}

const session = (path) => sessions[MODELS.find((name) => path.includes(name))]

/** Input and output names of the model stored at `path` (as homr names its files). */
export const names = (path) => ({ inputs: session(path).inputNames, outputs: session(path).outputNames })

/**
 * Run a model. feeds: {input: {type, dims, data} | {keep: name of an output kept earlier}}.
 * Returns {output: {type, dims, data}} for the wanted outputs, except "cache_out…" ones,
 * which are kept here under their name.
 */
export async function run(path, feeds, wanted) {
  const inputs = {}
  const owned = []
  let results
  try {
    for (const [name, feed] of Object.entries(feeds)) {
      const tensor = feed.keep ? kept.get(`${path}/${feed.keep}`) : new ort.Tensor(feed.type, feed.data, feed.dims)
      if (!tensor) throw new Error(`Missing recognition cache: ${feed.keep}`)
      inputs[name] = tensor
      if (!feed.keep) owned.push(tensor)
    }
    results = await session(path).run(inputs)
    const out = {}
    for (const name of wanted) {
      const tensor = results[name]
      if (name.startsWith('cache_out')) {
        const key = `${path}/${name}`, previous = kept.get(key)
        kept.set(key, tensor)
        if (previous && previous !== tensor) previous.dispose()
      } else {
        // Python consumes this after run() returns, so copy before releasing ORT's tensor.
        out[name] = { type: tensor.type, dims: [...tensor.dims], data: tensor.data.slice() }
      }
    }
    return out
  } finally {
    for (const tensor of owned) tensor.dispose()
    const retained = new Set(kept.values())
    for (const tensor of new Set(Object.values(results || {})))
      if (!retained.has(tensor)) tensor.dispose()
  }
}
