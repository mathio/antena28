const cheerio = require("cheerio");
const fetch = require("isomorphic-unfetch");

const extractors = {
  map886: (result) => {
    const data = (result && result.data) || [];
    return data.map((track) => {
      const { name, title } = track || {};
      if (name && title) {
        return `${name} - ${title}`;
      }
    });
  },
  mapRadioRock: (result) => {
    const data = result || [];
    return data.reverse().map((track) => {
      const { artist, title } = track || {};
      if (artist && title) {
        return `${artist} - ${title}`;
      }
    });
  },
  mapRadiaCz: (result) => {
    const $ = cheerio.load(result);
    return $(".interpret-song")
      .map((i, item) => {
        const artist = $(".interpret", item).text();
        const title = $(".song", item).text();
        return `${artist} - ${title}`;
      })
      .toArray()
      .reverse();
  },
};

const extractTracks = async (url, extractor, asJson) => {
  let result = {};

  const timeout = 10_000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(id);
    if (asJson) {
      result = await response.json();
    } else {
      result = await response.text();
    }
  } catch (e) {
    console.error("Failed while fetching tracks:".e);
  }

  return extractor(result).filter((v) => !!v);
};

module.exports = {
  extractors,
  extractTracks,
};
