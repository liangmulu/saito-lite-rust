module.exports = (app, mod, images) => {
  let imgs = ``;
  let tweet_picture_height = "450px";
  if (images.length > 1) {
    tweet_picture_height = "200px"
  }

  if (images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      imgs += `<div><img class="image-${i}" data-index="${i}" alt="saito dymamic image" src="${images[i]}"></div>`;
    }
  }

  return `<div class="tweet-picture"><div class="saito-img-flex" style="--image-height:${tweet_picture_height}">${imgs}</div></div>`;
};
