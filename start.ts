// import "source-map-support/register";

import Server, { NodeSharedMethods } from "./lib/saito/core/server";
import StorageCore from "./lib/saito/core/storage-core";
import { Saito } from "./apps/core";
import SharedMethods from "saito-js/shared_methods";
import S, { initialize as initS } from "saito-js/index.node";
import mods_config from "./config/modules.config";
import fs from "fs";
import process from "process";
import { WebSocket, WebSocketServer } from "ws";
import configs from "./config/configs.json";

async function initSaito() {
  const app = new Saito({
    mod_paths: mods_config.core,
  });
  await initS(configs, new NodeSharedMethods(app)).then(() => {
    console.log("zzzzzzzzzzzzzzz");
  });

  app.server = new Server(app);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  app.storage = new StorageCore(app);

  app.BROWSER = 0;
  app.SPVMODE = 0;

  //
  // set basedir
  //
  global.__webdir = __dirname + "/lib/saito/web/";

  await app.init();

  const { protocol, host, port } = app.options.server;

  const localServer = `${protocol}://${host}:${port}`;

  console.log(`

                                           
                     ◼◼◼                   
                  ◼◼   ◼ ◼◼                
               ◼◼◼      ◼  ◼◼◼             
            ◼◼◼          ◼    ◼◼◼          
         ◼◼◼              ◼      ◼◼◼       
       ◼◼◼                 ◼       ◼◼◼     
    ◼◼◼                     ◼         ◼◼◼  
   ◼◼◼                       ◼         ◼◼◼ 
   ◼  ◼◼◼                     ◼     ◼◼◼  ◼ 
   ◼     ◼◼◼                   ◼  ◼◼◼    ◼ 
   ◼       ◼◼◼                 ◼◼◼       ◼ 
   ◼        ◼ ◼◼◼           ◼◼◼          ◼ 
   ◼       ◼     ◼◼◼     ◼◼◼             ◼ 
   ◼      ◼         ◼◼ ◼◼                ◼ 
   ◼     ◼            ◼                  ◼ 
   ◼    ◼             ◼                  ◼ 
   ◼   ◼              ◼                  ◼ 
   ◼  ◼               ◼                  ◼ 
   ◼ ◼                ◼                  ◼ 
   ◼◼                 ◼                  ◼ 
   ◼◼                 ◼◼◼◼◼◼◼◼◼◼◼◼◼◼◼◼◼◼◼◼ 
    ◼◼◼               ◼               ◼◼◼  
       ◼◼◼            ◼            ◼◼◼     
         ◼◼◼          ◼          ◼◼◼       
            ◼◼◼       ◼       ◼◼◼          
               ◼◼◼    ◼    ◼◼◼             
                  ◼◼  ◼  ◼◼                
                     ◼◼◼                   
                                           
    ################################################################

    Welcome to Saito

    address: ${app.wallet.getPublicKey()}
    balance: ${await app.wallet.getBalance()}
    local module server: ${localServer}

    ################################################################

    This is the address and balance of your computer on the Saito network. Once Saito
    is running it will generate tokens automatically over time. The more transactions
    you process the greater the chance that you will be rewarded for the work.

    For inquiries please visit our website: https://saito.io

  `);

  function shutdownSaito() {
    console.log("Shutting down Saito");
    app.server.close();
    app.network.close();
  }

  /////////////////////
  // Cntl-C to Close //
  /////////////////////
  process.on("SIGTERM", function () {
    shutdownSaito();
    console.log("Network Shutdown");
    process.exit(0);
  });
  process.on("SIGINT", function () {
    shutdownSaito();
    console.log("Network Shutdown");
    process.exit(0);
  });
}

initSaito().catch((e) => console.error(e));
