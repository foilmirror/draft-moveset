import { toID } from "@pkmn/data";
import { GenerationNum } from "@pkmn/types";
import { Generations, Data, Species } from "@pkmn/data";
import { Dex } from "@pkmn/dex";
import { Nonstandard } from "@pkmn/types";
import { createReadStream, createWriteStream, writeFile, readFileSync, WriteStream } from "fs";
import { json2csv } from "json-2-csv";

import * as path from "node:path";

import format from './formatConfig.json' assert { type: "json" };

const dataDir = "./data";
const filepath = path.resolve("moves.csv");
const fileContent = readFileSync(filepath, { encoding: 'utf-8' });
const moves = fileContent.split(',');


const NATDEX_UNOBTAINABLE_SPECIES = [
  'Eevee-Starter', 'Floette-Eternal', 'Pichu-Spiky-eared', 'Pikachu-Belle', 'Pikachu-Cosplay',
  'Pikachu-Libre', 'Pikachu-PhD', 'Pikachu-Pop-Star', 'Pikachu-Rock-Star', 'Pikachu-Starter',
  'Eternatus-Eternamax',
];
const NATDEX_EXISTS = (d: Data) => {
  if (!d.exists) return false;
  if (d.kind === 'Ability' && d.id === 'noability') return false;
  // CAP
  if ('isNonstandard' in d && d.isNonstandard && d.isNonstandard !== 'Past') return false;
  if (d.kind === 'Species' && NATDEX_UNOBTAINABLE_SPECIES.includes(d.name)) return false;
  return !(d.kind === 'Item' && ['Past', 'Unobtainable'].includes(d.isNonstandard!) &&
    !d.zMove && !d.itemUser && !d.forcedForme);
};

var gens = new Generations(Dex);
var natdexLabel = "";
if (format.natdex == true) {
    gens = new Generations(Dex, NATDEX_EXISTS);
    natdexLabel = "ND";
}


async function writeLearnsetCsv() {
  const learnMethodByPokemonPsId_MovePsId = new Map<string, Set<string>>();

  const gen = gens.get(format.gen);
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
              if (format.natdex == false && learnMethod.indexOf(genString) !== 0) {
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

  
  if (format.technoStyle == true) {
    type PokemonLearnsMoveRow = {
      pokemonPsId: string;
      movePsId: string;
    };
    const learnsetRows: PokemonLearnsMoveRow[] = [];

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
      path.join(dataDir, "gen" + format.gen.toString() + natdexLabel + "learnset") + ".csv",
      json2csv(learnsetRows, { emptyFieldValue: "" }),
      console.error
    );
  }
  else {
    /*const csvWriter = createArrayCsvWriter({
      header: moves,
      path: path.join(dataDir, "gen" + format.gen.toString() + natdexLabel + "learnset") + ".csv"
    });*/

    const n = 1000; 
    const monmoves: String[][] = new Array(n)
                                   .fill("")
                                   .map(() => 
                                     new Array(n).fill("")
                                   );
    var count = 0
    for (const move of moves) {
      count = 0;
      for (let [key, value] of learnMethodByPokemonPsId_MovePsId.entries()) {
        const [genString, pokemonName, moveId] = key.split("_");
    
        if (!genString || !pokemonName || !moveId) {
          continue;
        }
        if (move == moveId) {
          console.log(pokemonName + " - " + moveId);
          
          monmoves[count]![moves.indexOf(move)] = pokemonName;
          count++;
        }
        
      }
  
    }
    /*for (let [key, value] of learnMethodByPokemonPsId_MovePsId.entries()) {
      const [genString, pokemonName, moveId] = key.split("_");
  
      if (!genString || !pokemonName || !moveId) {
        continue;
      }
      records.push(["a"])
    }*/

    /*csvWriter.writeRecords(monmoves)
    .then(() => {
        console.log('...Done');
    });*/
    /*writeFile(
      path.join(dataDir, "gen" + format.gen.toString() + natdexLabel + "learnset") + ".csv",
      json2csv(monmoves, { emptyFieldValue: "" }),
      console.error
    );*/
    const writeUsers = createWriteStream(path.join(dataDir, "gen" + format.gen.toString() + natdexLabel + "learnset") + ".csv");
    const header = moves.join(",") + "\n";
    writeUsers.write(header, 'utf8');

    writeTenMillionUsers(monmoves, writeUsers, 'utf-8', () => {
      writeUsers.end();
    });
  }

  
}

function writeTenMillionUsers(monmoves: String[][], writer: WriteStream, encoding: BufferEncoding, callback: () => void) {
  let i = 1000;
  let id = 0;
  function write() {
    let ok = true;
    do {
      i -= 1;
      const data = monmoves[id]?.join(",") + "\n";
      id += 1;
      if (i === 0) {
        writer.write(data, encoding, callback);
      } else {
// see if we should continue, or wait
// don't pass the callback, because we're not done yet.
        ok = writer.write(data, encoding);
      }
    } while (i > 0 && ok);
    if (i > 0) {
// had to stop early!
// write some more once it drains
      writer.once('drain', write);
    }
  }
write()
}

writeLearnsetCsv();