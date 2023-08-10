const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const sleep = (msFrom, msTo) =>
  new Promise((res) =>
    setTimeout(res, msTo ? randomInt(msFrom, msTo) : msFrom),
  );

module.exports = { sleep };
