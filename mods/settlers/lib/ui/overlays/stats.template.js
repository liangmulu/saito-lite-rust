module.exports = SettlersStatsOverlayTemplate = (stats) => {

    let html = `
      <div class="rules-overlay saitoa">`;


        // //VP Race
        // html += `<table class="stats-table vp-table"><caption>Victory Points</caption><thead><tr><th></th>`;
        // html += `<th><div class="tip token p${stats.mod.game.colors[stats.mod.game.player-1]}">${stats.mod.c1.svg}<div class="tiptext">${stats.mod.c1.name}</div></div></th>`;
        // html += `<th><div class="tip token p${stats.mod.game.colors[stats.mod.game.player-1]}">${stats.mod.c2.svg}<div class="tiptext">${stats.mod.c2.name}</div></div></th>`;
        // html += `<th><div class="tip token">${stats.mod.vp.img}<div class="tiptext">${stats.mod.vp.name}</div></div></th>`;
        // html += `<th><div class="tip token">${stats.mod.largest.img}<div class="tiptext">${stats.mod.largest.name}</div></div></th>`;
        // html += `<th><div class="tip token">${stats.mod.longest.svg}<div class="tiptext">${stats.mod.longest.name}</div></div></th>`;
        // html += `<th>Total</th></tr></thead><tbody>`;
        // //Sort players by VP
        // let ranking_scores = [stats.mod.game.state.players[0].vp];
        // let ranking_players = [0];
        // for (let i = 1; i < stats.mod.game.state.players.length; i++){
        //   let j = 0;
        //   for (; j < ranking_scores.length; j++){
        //     if (stats.mod.game.state.players[i].vp > ranking_scores[j]){
        //       break;
        //     }
        //   }
        //   ranking_scores.splice(j,0,stats.mod.game.state.players[i].vp);
        //   ranking_players.splice(j,0,i);
        // }
        // for (let i = 0; i < ranking_scores.length; i++){
        //   let player = ranking_players[i];
        //   let numVil = 0;
        //   let numCity = 0;
        //   for (let j = 0; j < stats.mod.game.state.cities.length; j++) {
        //     if (stats.mod.game.state.cities[j].player === player + 1) {
        //       if (stats.mod.game.state.cities[j].level == 1){
        //         numVil++;
        //       }else{
        //         numCity++;
        //       }
        //     }
        //   }

        //   html += `<tr><th>${stats.mod.game.playerNames[player]}</th>
        //             <td>${numVil}</td>
        //             <td>${numCity}</td>
        //             <td>${stats.mod.game.state.players[player].vpc}</td>
        //             <td>${(stats.mod.game.state.largestArmy.player == player + 1)?stats.mod.game.state.largestArmy.size:""}</td>
        //             <td>${(stats.mod.game.state.longestRoad.player == player + 1)?stats.mod.game.state.longestRoad.size:""}</td>
        //             <td>${ranking_scores[i]}</td></tr>`;
        // }


        // html += `</tbody></table>`;



        // //VP Race
        html += `<table class="stats-table vp-table">
                  <caption>Victory Points</caption>
                  <thead>
                    <tr>
                      <th></th>`;
        html += `</thead><tbody class="settlers-vp-race-body">`
        
        html += `</tbody>
                </table>`;       




      //Fucking Dice
        html += `<table class="stats-table">`;
        html += `<caption>Dice Rolls</caption>`;
        html += `</table>`;
        html += `<div class="settlers-dice-histogram">`
        for (let i = 2; i <= 12; i++){
          html += `  <div class="settlers-dice-bar dice-${i}" data-dice-rolls="${i}">
                      <div class="settlers-dice-count">${stats.mod.game.stats.dice[i]}</div>
                    </div>`;
        }
        html += `</div>`

        html += `<div class="settlers-dice-numbers">`
        for (let i = 2; i <= 12; i++){
          html += `<div class="settlers-dice-number">${i}</div>`;
        }
        html += `</div>`


      //
      //Production Log
      //
      html += `<table class="stats-table">`;
      html += `<caption>Resources Produced</caption><thead><tr><th></th>`;
      //for (let r in stats.mod.game.stats.production){
      //  html += `<th>${stats.mod.returnResourceHTML(r)}</th>`;
      //}
      //html += `<th>Sum</th></tr></thead>`;
      html += `<tbody>`;

      for (let j = 0; j < stats.mod.game.players.length; j++){
        let count = 0;
        html += `<tr><th>${stats.mod.game.playerNames[j]}</th>`;


        for (let r in stats.mod.game.stats.production){
        
          console.log("resources production ////////");
          console.log(stats.mod.game.stats.production);
          console.log(r);

          html+= `<td class="settlers-stats-resource-container"> 
            <img class="settlers-stats-resource-card" src="/settlers/img/cards/${r}.png" >
            <div class="settlers-stats-resource-count">${stats.mod.game.stats.production[r][j]}</div>
          </td>`;
        

          // html += `<td>${stats.mod.game.stats.production[r][j]}</td>`;
          count += stats.mod.game.stats.production[r][j]
        }
        // html += `<td><div class="settlers-stats-total">${count}</div></td></tr>`;
      }


      // html += `<tr><th>Total:</th>`;
      // for (let r in stats.mod.game.stats.production){
      //   let count = 0;
      //   for (let j = 0; j < stats.mod.game.players.length; j++){
      //     count += stats.mod.game.stats.production[r][j];
      //   }
      //   html += `<td>${count}</td>`;
      // }
      // html += `</tr>`;
      

      html += `</tbody></table>`;

      return html+"</div>";

}
