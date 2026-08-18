function calculateLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

function xpForLevel(level) {
  return Math.pow(level / 0.1, 2);
}

function randomXp(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { calculateLevel, xpForLevel, randomXp };
