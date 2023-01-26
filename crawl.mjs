/* 
    "axios": "^1.2.3",
    "cheerio": "1.0.0-rc.12",
*/

import axios from "axios";
import { AxiosError } from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import { env, argv } from "process";

const ARIA2_API = env?.ARIA2_API
  ? env.ARIA2_API
  : "http://localhost:6800/jsonrpc";
const TARGET_PAGE = env?.TARGET_PAGE
  ? env.TARGET_PAGE
  : "https://www.dbmp4.com/detail/29894.html";

let recordMap = {};

const makeRPC = async (method, params) => {
  try {
    const resp = await axios.post(
      ARIA2_API,
      { jsonrpc: "2.0", id: "CRAWLER", method, params },
      { timeout: 10000, headers: { "Content-Type": "application/json" } }
    );
    const { request, config, ...others } = resp;
    return others;
  } catch (err) {
    console.log("!ERROR: ", err.message);
    throw err;
  }
};

(async () => {
  try {
    const records = JSON.parse(fs.readFileSync("records.json"));
    recordMap = records.reduce(
      (d, v) => {
        return { ...d, [v.name]: v };
      },
      { [records[0].name]: records[0] }
    );
  } catch (error) {
    fs.writeFileSync("records.json", "[]");
    console.log("!WARN: create records.json");
  }
  try {
    const $ = await axios
      .get(TARGET_PAGE, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 Chrome/109.0.0.0" },
      })
      .then((resp) => {
        if (resp.status === 200) {
          return cheerio.load(resp.data);
        }
        console.log("!ERROR: ", `code ${resp.status}; ${resp.message}`);
        throw new AxiosError({ response: resp });
      })
      .catch((err) => {
        console.log("!ERROR: ", `Fetch target page failed; ${err.message}.`);
        throw err;
      });
    const script = $("div.article.content > script").text();
    if (!/\|EP\d{2}\|/.test(script)) {
      console.log("!ABORT: Something wrong");
      return;
    }
    let to_eval;
    eval("to_eval=String" + script.slice(4)); // dean.edwards.name/unpacker/
    const { Data } = eval(
      `JSON.parse(${to_eval.match(/^var \w+=('.*');?$/)[1]})`
    ); // replace variable name
    let eps = Data[0].downurls;
    eps = eps.map((ep) => {
      const [name, magnet] = ep.split("$");
      return { name, magnet, done: false };
    });
    const todo = eps.filter(
      (ep) =>
        !(ep.name in recordMap) || // not recorded
        !recordMap[ep.name].done // or not done
    );
    recordMap = todo.reduce((d, v) => {
      return { ...d, [v.name]: v };
    }, recordMap);

    if (!todo.length) {
      console.log("!INFO: Finished crawling with nothing to do");
      return;
    }

    console.log("!INFO: Got results.\nTODO =", todo);
    fs.writeFileSync(
      "records.json",
      JSON.stringify(Object.keys(recordMap).map((k) => recordMap[k]))
    );
    console.log("!INFO: records.json updated.");

    if (process.argv[2] === "--dry-run") {
      console.log("!WARN: Dry run, exit.");
      return;
    }

    const resp = await makeRPC("aria2.getGlobalStat");
    if (resp.data?.result?.numActive) {
      console.log("!INFO: aria2 active:\n", resp.data.result);
      todo.forEach((item, i) => {
        makeRPC("aria2.addUri", [[item.magnet]]).then((resp) => {
          resp.status === 200 && console.log(`!INFO: ${item.name} added.`);
          recordMap[item.name].done = true;
        });
      });
      console.log(
        "!INFO: Check status:\n",
        (await makeRPC("aria2.getGlobalStat")).data.result
      );
      fs.writeFileSync(
        "records.json",
        JSON.stringify(Object.keys(recordMap).map((k) => recordMap[k]))
      );
      console.log("!INFO: records.json updated.");
    }
  } catch (err) {
    // console.log(err);
    console.log("!ABORT: ", `Error happened.(${err.code})`);
  }
})();
