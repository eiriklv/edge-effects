'use strict';

/**
 * Redux
 */
const {
  createStore,
  applyMiddleware,
} = require('../provided/redux');

/**
 * Redux middleware
 */
const {
  addDispatchSubscriptionToStore,
  addLoggingToStore,
} = require('../provided/middleware');

/**
 * Effects
 */
const {
  call,
  callProc,
  cps,
  race,
  parallel,
  putAction,
  takeAction,
  putStream,
  takeStream,
  putEvent,
  takeEvent,
} = require('../provided/effects');

/**
 * Utils
 */
const {
  delay,
} = require('../utils');

/**
 * Runtime
 */
const createRuntime = require('../lib/runtime');

/**
 * Middleware to add logging of the context
 */
function* logMiddleware() {
  console.log(this);
}

/**
 * A process we want to run
 * that communicates with another
 * process by putting actions into
 * the event loop and listening for actions
 */
function* processOne() {
  while (true) {
    yield takeAction.describe('PING');
    yield call.describe(delay, 2000);
    yield putAction.describe({ type: 'PONG' });
  }
}

/**
 * A process we want to run
 * that communicates with another
 * process by putting actions into
 * the event loop and listening for actions
 */
function* processTwo() {
  while (true) {
    yield putAction.describe({ type: 'PING' });
    yield takeAction.describe('PONG');
    yield call.describe(delay, 2000);
  }
}

/**
 * Create a handler that will handle
 * the built up context of each program that is run
 */
function finalHandler(err, value) {
  console.log(this);
}

/**
 * Create a state reducer function
 */
function reducer(state = {}, action) {
  switch (action.type) {
    case 'SOME_ACTION':
      return state;
    default:
      return state;
  }
}

/**
 * Run the program using our runtime
 */
function application () {
  /**
   * Create instance of takeActionsMiddleware
   */
  const subscribeToDispatchMiddleware = addDispatchSubscriptionToStore({});

  /**
   * Create instance of logger middleware
   */
  const loggerMiddleware = addLoggingToStore({});

  /**
   * Application state handler
   */
  const store = createStore(
    reducer,
    applyMiddleware(
      subscribeToDispatchMiddleware,
      loggerMiddleware
    )
  );

  /**
   * Create subscriber for state changes
   */
  store.subscribe(() => {
    console.log('state changed!', store.getState());
  });

  /**
   * Create the IO interface to pass to
   * the runtime for handling takeAction/putAction/select
   */
  const io = {
    dispatch: store.dispatch,
    subscribe: subscribeToDispatchMiddleware.subscribe,
    getState: store.getState,
  }

  /**
   * Create a runtime
   */
  const runtime = createRuntime([logMiddleware], {
    call,
    callProc,
    cps,
    race,
    parallel,
    putAction,
    takeAction,
    putStream,
    takeStream,
    putEvent,
    takeEvent,
  }, io);

  /**
   * Gather all the processes
   */
  const processes = [
    processOne,
    processTwo,
  ];

  /**
   * Dependencies / arguments for each process
   */
  const args = {};

  /**
   * Create a global context
   */
  const context = {};

  /**
   * Run all the processes
   */
  processes.forEach((proc) => {
    runtime(proc, context, finalHandler, args);
  });
}

/**
 * Start the application
 */
application();