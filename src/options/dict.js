/**
 * Mouse Dictionary (https://github.com/wtetsu/mouse-dictionary/)
 * Copyright 2018-present wtetsu
 * Licensed under MIT
 */

import LineReader from "./linereader";
import EijiroParser from "./eijiroparser";
import SimpleDictParser from "./simpledictparser";
import JsonDictParser from "./jsondictparser";
import env from "../env";

const save = dictData => {
  return new Promise(resolve => {
    chrome.storage.local.set(dictData, () => {
      resolve();
    });
  });
};

const load = async ({ file, encoding, format, event }) => {
  let parser = null;
  switch (format) {
    case "TSV":
      parser = new SimpleDictParser("\t");
      break;
    case "PDIC_LINE":
      parser = new SimpleDictParser(" /// ");
      break;
    case "EIJIRO":
      parser = new EijiroParser();
      break;
    case "JSON":
      parser = new JsonDictParser();
      break;
  }
  if (parser === null) {
    throw new Error("Unknown File Format: " + format);
  }

  const ev = event || (() => {});

  return new Promise((resolve, reject) => {
    let wordCount = 0;
    var reader = new FileReader();
    reader.onprogress = e => {
      ev({ name: "reading", loaded: e.loaded, total: e.total });
    };
    reader.onload = e => {
      let data = e.target.result;

      var dictData = {};

      let reader = new LineReader(data);
      reader.eachLine(
        line => {
          const hd = parser.addLine(line);
          if (hd) {
            dictData[hd.head] = hd.desc;
            wordCount += 1;

            if (wordCount == 1 || (wordCount >= 1 && wordCount % env.registerRecordsAtOnce === 0)) {
              ev({ name: "loading", count: wordCount, word: hd });
              let tmp = dictData;
              dictData = {};
              return save(tmp);
            }
          }
        },
        () => {
          // finished
          let lastData;
          try {
            lastData = parser.flush();
          } catch (e) {
            reject(e);
          }
          if (lastData) {
            Object.assign(dictData, lastData);
            wordCount += Object.keys(lastData).length;
          }

          save(dictData).then(
            () => {
              resolve({ wordCount });
            },
            error => {
              throw new Error(`Error: ${error}`);
            }
          );

          dictData = null;
        }
      );
    };
    reader.readAsText(file, encoding);
  });
};

const registerDefaultDict = async () => {
  let wordCount = 0;
  wordCount += await registerDict("/data/initial_dict1.json");
  wordCount += await registerDict("/data/initial_dict2.json");
  return { wordCount };
};

const registerDict = async fname => {
  const url = chrome.extension.getURL(fname);

  const response = await fetch(url);
  const dictData = await response.json();

  const wordCount = Object.keys(dictData).length;

  await save(dictData);

  return wordCount;
};

export default { load, registerDefaultDict };
