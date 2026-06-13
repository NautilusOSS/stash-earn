import {
  AlgorandClient,
  getAlgoClient,
  getAlgoIndexerClient,
} from "@algorandfoundation/algokit-utils";
import type { AlgoClientConfig } from "@algorandfoundation/algokit-utils/types/network-client";
import algosdk from "algosdk";

import { getServerConfig } from "@/lib/config.server";
import { VOI_ALGOD_DEFAULT, VOI_INDEXER_DEFAULT } from "@/lib/voi/constants";

function getVoiAlgodConfig(): AlgoClientConfig {
  const voi = getServerConfig().voi;
  return {
    server: voi.algodServer ?? VOI_ALGOD_DEFAULT.server,
    port: String(voi.algodPort ?? VOI_ALGOD_DEFAULT.port),
    token: voi.algodToken ?? VOI_ALGOD_DEFAULT.token,
  };
}

function getVoiIndexerConfig(): AlgoClientConfig {
  const voi = getServerConfig().voi;
  return {
    server: voi.indexerServer ?? VOI_INDEXER_DEFAULT.server,
    port: String(voi.indexerPort ?? VOI_INDEXER_DEFAULT.port),
    token: voi.indexerToken ?? VOI_INDEXER_DEFAULT.token,
  };
}

/** Raw algosdk algod client for txn params, submit, and confirm. */
export function getVoiAlgodClient(): algosdk.Algodv2 {
  return getAlgoClient(getVoiAlgodConfig());
}

/** Raw algosdk indexer client. */
export function getVoiIndexerClient(): algosdk.Indexer {
  return getAlgoIndexerClient(getVoiIndexerConfig());
}

/** AlgorandClient for TEAL template compilation and algokit-utils helpers. */
export function getVoiAlgorandClient(): AlgorandClient {
  return AlgorandClient.fromConfig({
    algodConfig: getVoiAlgodConfig(),
    indexerConfig: getVoiIndexerConfig(),
  });
}
