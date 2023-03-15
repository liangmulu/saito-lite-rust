import Transaction from "./transaction";
import Peer from "./peer";
import S from "saito-js/saito";

export default class Network {
  callbacks = [];

  initialize() {
    console.debug("[DEBUG] initialize network");

    // if (this.app.options) {
    //   if (this.app.options.server) {
    //     if (
    //       this.app.options.server.receiveblks !== undefined &&
    //       this.app.options.server.receiveblks === 0
    //     ) {
    //       this.receiveblks = 0;
    //     }
    //     if (
    //       this.app.options.server.receivetxs !== undefined &&
    //       this.app.options.server.receivetxs === 0
    //     ) {
    //       this.receivetxs = 0;
    //     }
    //     if (
    //       this.app.options.server.receivegts !== undefined &&
    //       this.app.options.server.receivegts === 0
    //     ) {
    //       this.receivegts = 0;
    //     }
    //     if (
    //       this.app.options.server.sendblks !== undefined &&
    //       this.app.options.server.sendblks === 0
    //     ) {
    //       this.sendblks = 0;
    //     }
    //     if (
    //       this.app.options.server.sendtxs !== undefined &&
    //       this.app.options.server.sendtxs === 0
    //     ) {
    //       this.sendtxs = 0;
    //     }
    //     if (
    //       this.app.options.server.sendgts !== undefined &&
    //       this.app.options.server.sendgts === 0
    //     ) {
    //       this.sendgts = 0;
    //     }
    //   }
    // }

    // if (this.app.options.peers != null) {
    //   console.debug("[DEBUG] peers length " + this.app.options.peers.length);
    //   for (let i = 0; i < this.app.options.peers.length; i++) {
    //     this.addPeer(JSON.stringify(this.app.options.peers[i]));
    //   }
    // } else {
    //   console.debug("[DEBUG] no peers defined");
    // }

    //
    // this.peer_monitor_timer = setInterval(() => {
    //   this.pollPeers();
    // }, this.peer_monitor_timer_speed);
  }

  public async propagateTransaction(tx: Transaction) {
    return S.getInstance().propagateTransaction(tx);
  }

  public getPeers() {
    return S.getInstance().getPeers();
  }

  public get peers(): Array<Peer> {
    return S.getInstance().getPeers();
  }

  public getPeer(index: bigint) {
    return S.getInstance().getPeer(index);
  }

  public async sendRequest(message: string, data: any = "", peer: Peer = null) {
    let buffer = Buffer.from(JSON.stringify(data), "utf-8");
    return S.getInstance().sendRequest(message, data, peer ? peer.peerIndex : undefined);
  }

  public async sendTransactionWithCallback(
    transaction: Transaction,
    callback?: any,
    peerIndex?: bigint
  ) {
    return S.getInstance().sendTransactionWithCallback(transaction, callback, peerIndex);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public close() {
    throw new Error("not implemented");
  }

  addStunPeer() {
    throw new Error("not implemented");
  }

  initializeStun() {
    throw new Error("not implemented");
  }

  public async sendRequestAsTransaction(
    message: string,
    data: any = "",
    callback?: any,
    peerIndex?: bigint
  ) {
    return S.getInstance().sendRequest(message, data, callback, peerIndex);
  }

  returnPeersWithService() {}
}
