const MixinWithdrawTemplate = require("./mixin-history.template");
const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");

class MixinHistory {

  constructor(app, mod, container = "") {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.ticker = null;
    this.his_exists = false;
    this.his_asset_id = null;
  }

  render() {
    this.overlay.show(MixinHistoryTemplate(this.app, this.mod, this));
    
    this.mod.fetchSnapshots("", 20, "DESC", (d) => { 
      let html = "";
      if (d.data.length > 0) {
        for (let i = 0; i < d.data.length; i++) {

          let ticker = '';
          let asset_id = '';
          for (let j=0; j<mod.mods.length; j++) {
            if (mod.mods[j].asset_id == d.data[i].asset_id) {
              ticker = mod.mods[j].ticker;
              asset_id = mod.mods[j].asset_id;
              break;
            }
          }

          if (this.his_asset_id == asset_id) {
            this.his_exists = true;
            let trans = d.data[i];
            let created_at = trans.created_at.slice(0, 19).replace('T', ' ');
            let type = (trans.closing_balance > trans.opening_balance) ? 'Deposit' : 'Withdrawal';
            let amount = trans.amount;
            let indicator = (type == 'Deposit') ? '+' : '';

            document.querySelector(".mixin-txn-his-container .saito-table-body").innerHTML = '';
            html = "<div class='saito-table-row'><div class='mixin-his-created-at'>"+ created_at +"</div>" +
            "<div>"+ type +"</div>" +
            "<div class='"+ type.toLowerCase() +"'>"+ indicator + " " + amount +"</div>" +
            "<div>Success</div></div>"; /* right now we dont get `status` in /snapshot api, all trans are `success`*/
            
            document.querySelector(".mixin-txn-his-container .saito-table-body").innerHTML += html;
          }
        }
      }

      if (!this.his_exists) {
        document.querySelector(".mixin-txn-his-container .saito-table-body").innerHTML = '<p class="mixin-no-history">No account history found.</p>';
        document.getElementById('mixin-history-button').setAttribute("class", "hide-btn");
      }
    });


    this.attachEvents();
  }  

  attachEvents() {    


  }

}

module.exports = MixinHistory;

