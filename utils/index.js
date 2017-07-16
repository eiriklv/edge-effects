function isPromise(obj) {
  return (
    isObject(obj) &&
    'then' in obj &&
    typeof isFunction(obj.then)
  );
}

function isFunction(obj) {
  return typeof obj === 'function';
}

function isObject(obj) {
  return typeof obj === 'object' && obj instanceof Object;
}

function isSpecObject(obj) {
  return (
    isObject(obj) &&
    typeof obj.type === 'string' &&
    !!obj.type
  );
}

function delay(ms, val) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(val);
    }, ms);
  });
}

function safePromise(promise) {
  return promise
  .then(result => [null, result])
  .catch(error => [error, null]);
}

module.exports = {
  isPromise,
  isFunction,
  isObject,
  isSpecObject,
  delay,
  safePromise,
};
