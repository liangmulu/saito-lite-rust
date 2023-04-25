module.exports = SettlersScoreboardTemplate = (scoreboard) => {

  let html = `
    <div id="build-info" class="saito-button" style="
    position: absolute;
    z-index: 10;
    left: 0px;
    bottom: 50vh;
    width: 13rem;
    height: 6rem;
    background: var(--saito-button-background);
    color: var(--saito-profile-background);
    line-height: 6rem;
    text-align: center;
    cursor: pointer;
">Build Info</div>
  `;
  html += `
    <div class="scoreboard">
    <div class="VP-track-label" id="VP-track-label">Victory Points</div>
  `;

  for (let j = scoreboard.mod.game.options.game_length; j >= 0; j--) {
    html += '<div class="vp ' + j + '-points"><div class="player-vp-background">' + j + '</div>';
    html += '<div class="vp-players">'
    for (let i = 0; i < scoreboard.mod.game.state.players.length; i++) {
      if (scoreboard.mod.game.state.players[i].vp == j) {
        html += `  <div class="player-vp" style="background-color:var(--p${scoreboard.mod.game.colors[i]}-color);"><div class="vp-faction-name">${scoreboard.mod.game.playerNames[i]}</div></div>`;
      }
    }
    html += '</div></div>';
  }
  html += '</div>';

  return html;
}


