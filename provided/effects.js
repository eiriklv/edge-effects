/**
 * Helpers
 */
const {
  isSpecObject,
  isPromise,
  isFunction,
  isObject,
  safePromise,
} = require('../utils');

/**
 * Create an effect bundle for rendering
 * an application to the console (just logging for now)
 *
 * NOTE: This just logs the state at the moment
 * TODO: Make this render a React app into the DOM
 */
const render = {
  describe(app, commands, state) {
    return {
      type: '@@render',
      app,
      commands,
      state,
    };
  },
  resolve({ app, commands, state }, io, engine, cb) {
    console.log('rendering app:');
    console.log(app({ commands, state }));
    cb();
  },
}

/**
 * Create an effect bundle for forking
 * a generator function / process
 *
 * Handle attached forks of processes
 * and returns a task object
 *
 * NOTE: Starts a new process and immediately
 * continues (non-blocking)
 *
 * TODO: Work needed regarding attaching / detaching
 * (see how redux-saga does this)
 */
const fork = {
  describe(proc, ...args) {
    return {
      type: '@@fork',
      proc,
      args,
    };
  },
  resolve({ proc, args }, io, { runtime, context }, cb) {
    runtime(proc, context, undefined, ...args);
    cb();
  },
}

/**
 * Create an effect bundle for spawning
 * a generator function / process
 *
 * Handle detached forks of processes
 * and returns a task object
 *
 * NOTE: Starts a new process and immediately
 * continues (non-blocking)
 *
 * TODO: Work needed regarding attaching / detaching
 * (see how redux-saga does this)
 */
const spawn = {
  describe(proc, ...args) {
    return {
      type: '@@spawn',
      proc,
      args,
    };
  },
  resolve({ proc, args }, io, { runtime, context }, cb) {
    runtime(proc, context, undefined, ...args);
    cb();
  },
}

/**
 * Create an effect bundle for calling
 * a process that might return a value
 *
 * Handle calls of processes
 *
 * NOTE: Waits for the return value of the
 * process before continuing (blocking)
 */
const callProc = {
  describe(proc, ...args) {
    return {
      type: '@@callProc',
      proc,
      args,
    };
  },
  resolve({ proc, args }, io, { runtime, context }, cb) {
    runtime(proc, context, cb, ...args);
  },
}

/**
 * Create promise delay effect bundle
 *
 * Handle an effect spec of the delay type
 */
const delay = {
  describe(time, val) {
    return {
      type: '@@delay',
      time,
      val,
    };
  },
  resolve({ val, time }, io, engine, cb) {
    setTimeout(() => {
      cb(null, val);
    }, time);
  },
}

/**
 * NOTE: Higher order effect bundle
 *
 * Create an effect bundle for parallel effects
 *
 * Handle an effect spec of the parallel type
 */
const parallel = {
  describe(effects) {
    return {
      type: '@@parallel',
      effects,
    };
  },
  resolve({ effects }, io, { resolveEffects }, cb) {
    return Promise.all(effects.map(effect => {
      return new Promise((resolve, reject) => {
        resolveEffects(effect, (err, result) => {
          if (err) {
            return reject(err);
          } else {
            return resolve(result);
          }
        })
      });
    }))
    .then((result) => cb(null, result))
    .catch((error) => cb(error));
  },
}

/**
 * NOTE: Higher order effect
 *
 * Create an effect bundle for racing effects
 *
 * Handle an effect spec of the race type
 *
 * NOTE: This supports both arrays and dictionaries as effects
 * - Array => [effectOne, effectTwo, ...]
 * - Dictionary =>  { effectsOne: effect, effectTwo: effect, ...}
 */
const race = {
  describe(effects) {
    return {
      type: '@@race',
      effects,
    };
  },
  resolve({ effects }, io, { resolveEffects }, cb) {
    /**
     * Check if the effects are represented by a dictionary or an array
     */
    const isDictionary = (
      typeof effects === 'object' &&
      !Array.isArray(effects)
    );

    /**
     * Handle dictionary effects
     */
    if (isDictionary) {
      /**
       * Get all the effect labels
       */
      const labels = Object.keys(effects);

      /**
       * Resolve the effects recursively
       */
      return Promise.race(labels.map((label) => {
        return new Promise((resolve, reject) => {
          resolveEffects(effects[label], (err, result) => {
            if (err) {
              return reject(err);
            } else {
              return resolve({ [label]: result });
            }
          });
        });
      }))
      .then((result) => cb(null, result))
      .catch((error) => cb(error));
    }

    /**
     * Handle array effects
     */
    return Promise.race(effects.map(effect => {
      return new Promise((resolve, reject) => {
        resolveEffects(effect, (err, result) => {
          if (err) {
            return reject(err);
          } else {
            return resolve(result);
          }
        });
      });
    }))
    .then((result) => cb(null, result))
    .catch((error) => cb(error));
  },
}

/**
 * Create an effect bundle for calling
 * a function that returns a promise
 * or a value and might have side effects
 *
 * Handle an effect spec of the call type
 * which resolves both synchronous function
 * calls and function calls that returns a promise
 */
const call = {
  describe(func, ...args) {
    return {
      type: '@@call',
      func,
      args,
    };
  },
  resolve({ func, args }, io, engine, cb) {
    let result;
    let error;

    try {
      result = func(...args);
    } catch (e) {
      error = e;
    }

    return (error ? Promise.reject(error) : Promise.resolve(result))
    .then((res) => cb(null, res))
    .catch((err) => cb(err));
  },
}

/**
 * Create an effect bundle for calling
 * a function that returns a promise
 * or a value and might have side effects
 *
 * NOTE: This will return a tuple containing
 * a possible error instead of throwing
 *
 * Handle an effect spec of the call type
 * which resolves both synchronous function
 * calls and function calls that returns a promise
 *
 * NOTE: This will return a "tuple" (array of the form [error, result])
 * containing a possible error instead of throwing
 */
const safeCall = {
  describe(func, ...args) {
    return {
      type: '@@safeCall',
      func,
      args,
    };
  },
  resolve({ func, args }, io, engine, cb) {
    let result;
    let error;

    try {
      result = func(...args);
    } catch (e) {
      error = e;
    }

    return safePromise(error ? Promise.reject(error) : Promise.resolve(result))
    .then(([err, res]) => cb(null, [err, res]));
  },
}

/**
 * Create an effect bundle for calling
 * a node callback / continuation passing
 * style function
 *
 * Handle an effect spec of the call type
 * which resolves both synchronous function
 * calls and function calls that returns a promise
 */
const cps = {
  describe(func, ...args) {
    return {
      type: '@@cps',
      func,
      args,
    };
  },
  resolve({ func, args }, io, engine, cb) {
    return func(...args, cb);
  },
}

/**
 * Create an effect bundle for putting
 * an action into the chain for processing
 *
 * Handle an effect spec of the put-stream
 * type which resolves putting a value on a stream
 */
const putStream = {
  describe(stream, data) {
    return {
      type: '@@putStream',
      stream,
      data,
    };
  },
  resolve({ stream, data }, io, engine, cb) {
    stream.write(data);
    cb(null);
  },
}

/**
 * Create an effect bundle for taking
 * an action from the chain
 *
 * Handle an effect spec of the take-stream
 * type which resolves taking a value from a stream
 */
const takeStream = {
  describe(stream) {
    return {
      type: '@@takeStream',
      stream,
    };
  },
  resolve({ stream }, io, engine, cb) {
    const listener = (data) => {
      stream.removeListener('data', listener);
      cb(null, data);
    }
    stream.on('data', listener);
  },
}

/**
 * Create an effect bundle for taking
 * an action from the chain
 *
 * Handle an effect spec of the take-event
 * type which resolves taking an event from
 * an event emitter
 */
const takeEvent = {
  describe(emitter, event) {
    return {
      type: '@@takeEvent',
      emitter,
      event,
    };
  },
  resolve({ emitter, event, data }, io, engine, cb) {
    const listener = (data) => {
      emitter.removeListener(event, listener);
      cb(null, data);
    }
    emitter.on(event, listener);
  },
}

/**
 * Create an effect bundle for putting
 * an action into the chain for processing
 *
 * Handle an effect spec of the put-event
 * type which resolves putting an event
 * on an event emitter
 */
const putEvent = {
  describe(emitter, event, data) {
    return {
      type: '@@putEvent',
      emitter,
      event,
      data,
    };
  },
  resolve({ emitter, event, data }, io, engine, cb) {
    emitter.emit(event, data);
    cb(null);
  },
}

/**
 * Create an effect bundle for selecting
 * something from the store state
 * using a selector function
 *
 * Handle an effect spec of the select
 * type which resolves selecting state
 * from the io
 */
const select = {
  describe(selector) {
    return {
      type: '@@select',
      selector,
    };
  },
  resolve({
    selector = (state) => state,
  }, {
    getState = () => { console.log('No IO for getState present') },
  }, engine, cb) {
    cb(null, selector(getState()));
  },
}

/**
 * Create an effect bundle for putting
 * an action into the chain for processing
 *
 * Handle an effect spec of the put-action
 * type which resolves dispatching actions
 * into the io system
 */
const putAction = {
  describe(action) {
    return {
      type: '@@putAction',
      action,
    };
  },
  resolve({ action }, { dispatch }, engine, cb) {
    cb(null, dispatch(action));
  },
}

/**
 * Create an effect bundle for taking
 * an action from the chain
 *
 * Handle an effect spec of the take-action
 * type which resolves taking actions from
 * the io system
 *
 * TODO: Support patterns other than '*'?
 */
const takeAction = {
  describe(actionType) {
    return {
      type: '@@takeAction',
      actionType,
    };
  },
  resolve({ actionType = '*' }, { subscribe }, engine, cb) {
    const unsubscribe = subscribe((action = {}) => {
      const { type = '' } = action;

      if (
        actionType === type ||
        actionType === '*'
      ) {
        unsubscribe();
        cb(null, action);
      }
    });
  },
}

/**
 * Create an effect bundle for taking
 * an action from the system based
 * on a type or a pattern
 *
 * Handle an effect spec of the take-action
 * type which resolves taking actions from
 * the io system
 */
const take = {
  describe(typeOrPattern) {
    return {
      type: '@@take',
      typeOrPattern,
    };
  },
  resolve({ typeOrPattern = '*' }, { subscribe }, engine, cb) {
    const unsubscribe = subscribe((action = {}) => {
      const { type = '' } = action;
      unsubscribe();
      cb(null, action);
    }, typeOrPattern);
  },
}

/**
 * Create an effect bundle for putting
 * an action into the system
 *
 * Handle an effect spec of the put-action
 * type which resolves dispatching actions
 * into the io system
 */
const put = {
  describe(action) {
    return {
      type: '@@put',
      action,
    };
  },
  resolve({ action }, { dispatch }, engine, cb) {
    cb(null, dispatch(action));
  },
}

/**
 * Exports
 */
module.exports = {
  fork,
  spawn,
  delay,
  call,
  safeCall,
  callProc,
  cps,
  race,
  parallel,
  put,
  take,
  putAction,
  takeAction,
  putStream,
  takeStream,
  putEvent,
  takeEvent,
  select,
  render,
}
