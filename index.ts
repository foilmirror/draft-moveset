import { toID } from "@pkmn/data";
import { GenerationNum } from "@pkmn/types";
import { Generations, Species } from "@pkmn/data";
import { Dex } from "@pkmn/dex";
import { Nonstandard } from "@pkmn/types";
import { createReadStream, writeFile, readFileSync } from "fs";
import { json2csv } from "json-2-csv";
import { parse } from "csv-parse";

import * as path from "node:path";

const dataDir = "./data";

const gens = new Generations(Dex);

type PokemonLearnsMoveRow = {
  pokemonPsId: string;
  movePsId: string;
};

const filepath = path.resolve("moves.csv");
const fileContent = readFileSync(filepath, { encoding: 'utf-8' });
const moves = fileContent.split(',');

async function writeLearnsetCsv() {
  const learnsetRows: PokemonLearnsMoveRow[] = [];

  const learnMethodByPokemonPsId_MovePsId = new Map<string, Set<string>>();

  const gen = gens.get(9);
  const learnsets = gen.learnsets;
  const genString = gen.num.toString();
  for (const move of moves) {
    for (const specie of gen.species) {
      for await (const learnset of learnsets.all(specie)) {
        const { learnset: learnData } = learnset;
        if (!learnData) {
          continue;
        }
  
        for (const [movePsId, learnMethods] of Object.entries(learnData)) {
          if (move.toLowerCase().replace(/\s/g, "") == movePsId) {
            for (let learnMethod of learnMethods) {
              if (learnMethod.indexOf(genString) !== 0) {
                continue;
              }
              // Not a real source
              else if (learnMethod.includes("C")) {
                continue;
              }
    
              learnMethod = learnMethod.replace(genString, "");
    
              const pokemonPsName = specie.name;
              const key = [genString, pokemonPsName, move].join("_");
    
              if (learnMethodByPokemonPsId_MovePsId.has(key)) {
                learnMethodByPokemonPsId_MovePsId.get(key)?.add(learnMethod);
              } else {
                learnMethodByPokemonPsId_MovePsId.set(
                  key,
                  new Set([learnMethod])
                );
              }
            }
          }
        }
      }
    }
  }

  

  for (let [key, value] of learnMethodByPokemonPsId_MovePsId.entries()) {
    const [genString, pokemonName, moveId] = key.split("_");

    if (!genString || !pokemonName || !moveId) {
      continue;
    }

    learnsetRows.push({
      pokemonPsId: pokemonName,
      movePsId: moveId,
    });
  }

  writeFile(
    path.join(dataDir, "learnset") + ".csv",
    json2csv(learnsetRows, { emptyFieldValue: "" }),
    console.error
  );
}

writeLearnsetCsv();