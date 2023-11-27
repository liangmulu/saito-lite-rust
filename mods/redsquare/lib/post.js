const SaitoUser = require("./../../../lib/saito/ui/saito-user/saito-user");
const PostTemplate = require("./post.template");
const SaitoOverlay = require("./../../../lib/saito/ui/saito-overlay/saito-overlay");
const SaitoInput = require("./../../../lib/saito/ui/saito-input/saito-input");
const JSON = require("json-bigint");

class Post {
  constructor(app, mod, tweet = null) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod, true, true);
    this.parent_id = "";
    this.thread_id = "";
    this.images = [];
    this.tweet = tweet; //For reply or Retweet

    this.user = new SaitoUser(
      this.app,
      this.mod,
      `.tweet-overlay-header`,
      this.mod.publicKey,
      `create a text-tweet${app.browser.isMobileBrowser() ? "" : " or drag-and-drop images"}...`
    );

    this.render_after_submit = 0;
    this.file_event_added = false;
    this.source = "Post";
  }

  render() {
    this.overlay.show(PostTemplate(this.app, this.mod, this));
    this.overlay.blockClose();

    //
    //
    //

    if (!this.input) {
      this.input = new SaitoInput(this.app, this.mod, ".tweet-overlay-content");
      this.input.enable_mentions = true;
    }

    this.input.display = "large";

    this.input.placeholder = "What's happening";
    if (this.source == "Retweet") {
      this.input.placeholder = "optional comment";
      this.user.notice = "add a comment to your retweet or just click submit...";
    }

    if (this.source == "Edit") {
      this.input.placeholder = this.tweet.text;
      this.user.notice = "tweets are editable for a brief period after posting...";
    }

    if (this.source == "Reply") {
      this.input.placeholder = "my reply...";
      this.user.notice = "add your comment to the tweet...";
    }

    this.input.callbackOnReturn = () => {
      this.postTweet();
    };

    this.input.callbackOnUpload = async (file) => {
      if (this.images.length >= 4) {
        salert("Maximum 4 images allowed per tweet.");
      } else if (file.includes("giphy.gif")) {
        this.addImg(file);
      } else {
        let type = file.substring(file.indexOf(":") + 1, file.indexOf(";"));
        if (this.mod.allowed_upload_types.includes(type)) {
          let resized_img = await this.app.browser.resizeImg(file);
          this.addImg(resized_img);
        } else {
          salert(`Cannot upload ${type} image, allowed file types: 
              ${this.mod.allowed_upload_types.join(", ")} 
              - this issue can be caused by image files missing common file-extensions. In this case try clicking on the image upload button and manually uploading.`);
        }
      }
    };

    this.user.render();

    this.input.render();
    this.input.focus(true);

    if (this.source == "Edit") {
      document.querySelector(".post-tweet-textarea").innerHTML = this.tweet.text;
    }

    this.attachEvents();
  }

  triggerClick(querySelector) {
    //console.log(querySelector);
    //console.log(document.querySelector(querySelector));
    if (document.querySelector(querySelector)) {
      document.querySelector(querySelector).click();
    }
  }

  attachEvents() {
    let post_self = this;
    post_self.images = [];

    if (post_self.file_event_added == false) {
      post_self.app.browser.addDragAndDropFileUploadToElement(
        "tweet-overlay",
        async (file) => {
          if (post_self.images.length >= 4) {
            salert("Maximum 4 images allowed per tweet.");
          } else {
            let type = file.substring(file.indexOf(":") + 1, file.indexOf(";"));
            if (post_self.mod.allowed_upload_types.includes(type)) {
              let resized_img = await this.app.browser.resizeImg(file);
              this.addImg(resized_img);
            } else {
              salert(
                "allowed file types: " +
                  post_self.mod.allowed_upload_types.join(", ") +
                  " - this issue can be caused by image files missing common file-extensions. In this case try clicking on the image upload button and manually uploading."
              );
            }
          }
          post_self.file_event_added = true;
        },
        false
      );
    }

    if (
      typeof document.querySelector(".my-form") != "undefined" &&
      document.querySelector(".my-form")
    ) {
      document.querySelector(".my-form").style.display = "none";
    }

    document.querySelector(".post-tweet-textarea").addEventListener("keydown", (e) => {
      if (e.keyCode === 13 && e.ctrlKey) {
        document.getElementById("post-tweet-button").click();
        e.preventDefault();
      }
    });
    try {
      document.getElementById("post-delete-button").addEventListener("click", (e) => {
        this.deleteTweet();
      });
    } catch (err) {}
    document.getElementById("post-tweet-button").addEventListener("click", (e) => {
      this.postTweet();
    });
  }

  async deleteTweet() {
    this.postTweet(1);
  }

  async postTweet(delete_tweet = 0) {

    let post_self = this;
    let text = sanitize(this.input.getInput());
    let parent_id = document.getElementById("parent_id").value;
    let thread_id = document.getElementById("thread_id").value;
    let source = document.getElementById("source").value;
    let keys = [];
    let identifiers = [];

    //don't send empty posts
    if (post_self.images.length == 0 && text.trim().length == 0 && post_self.source != "Retweet") {
      siteMessage("Post Empty", 1000);
      return;
    }

    //
    // extract keys from text AND then tweet
    //
    //keys = post_self.app.browser.extractKeys(text);
    //identifiers = post_self.app.browser.extractIdentifiers(text);
    //
    // add identifiers as available
    //
    //for (let i = 0; i < identifiers.length; i++) {
    //  let key = this.app.keychain.returnPublicKeyByIdentifier(identifiers[i]);
    //  if (key) {
    //    if (!keys.includes(key)) {
    //      keys.push(key);
    //    }
    //  }
    //}
    //
    // tweet data
    //
    let data = { text: text };
    let is_reply = false;


    keys = this.input.getMentions();

    if (keys.length > 0) {
      data["mentions"] = 1;
    }

    //
    // any previous recipients get added to "to"
    //
    if (post_self?.tweet?.tx) {
      for (let i = 0; i < post_self.tweet.tx.to.length; i++) {
        if (!keys.includes(post_self.tweet.tx.to[i].publicKey)) {
          keys.push(post_self.tweet.tx.to[i].publicKey);
        }
      }
    }

    //
    // saito-loader
    //
    post_self.overlay.hide();

    //Delete
    if (delete_tweet) {

      data = { tweet_id : this.tweet.tx.signature };
      this.tweet.remove();
      let newtx = await post_self.mod.sendDeleteTransaction(post_self.app, post_self.mod, data, keys);
      return;
    }

    //Edit
    if (source === "Edit") {
      data = { text: text, tweet_id : this.tweet.tx.signature };
      
      let qs = `.tweet-${this.tweet.tx.signature} .tweet-body .tweet-main .tweet-text`;
      let obj = document.querySelector(qs);
      if (obj) { obj.innerHTML = text; }
      
      let newtx = await post_self.mod.sendEditTransaction(post_self.app, post_self.mod, data, keys);
      return;
    }

    post_self.overlay.closebox = false;
    post_self.overlay.show('<div class="saito-loader"></div>');

    //Replies
    if (parent_id !== "") {
      is_reply = true;
      this.mod.replyTweet(this.tweet.tx.signature);
      data = { text: text, parent_id: parent_id, thread_id: thread_id, signature: parent_id };

      // We temporarily increase the number of replies, this affects the next rendering
      // but only adjust tx.optional when we get confirmation from the blockchain
      this.tweet.num_replies++;
    }

    //Retweets
    if (source == "Retweet") {
      data.retweet_tx = post_self.tweet.tx.serialize_to_web(this.app);
      data.signature = post_self.tweet.tx.signature;
      //save the tweet I am retweeting or replying to to my local archive
      this.mod.retweetTweet(this.tweet.tx.signature);

      // We temporarily increase the number of retweets, this affects the next rendering
      // but only adjust tx.optional when we get confirmation from the blockchain
      this.tweet.num_retweets++;
    }

    if (post_self.images.length > 0) {
      data["images"] = post_self.images;
    }


    let newtx = await post_self.mod.sendTweetTransaction(post_self.app, post_self.mod, data, keys);

    if (this.mod.manager) {
      if (!this.mod.manager.mode.includes("tweet")) {
        return;
      }
    }


    //
    // This makes no sense. If you require at the top of the file, it fails with a
    // new Tweet is not a constructor error!!! ???
    //
    const Tweet = require("./tweet");
    let posted_tweet = new Tweet(post_self.app, post_self.mod, newtx, ".tweet-manager");
    //console.log("New tweet:", posted_tweet);


    let rparent = this.tweet;
    if (rparent) {
      console.log("Rerender feed with temp stats");
      
      if (posted_tweet.retweet_tx) {

        rparent.render();
        this.mod.addTweet(newtx, true);
        posted_tweet.render(true);
      } else {

        this.mod.addTweet(newtx, true);
        if (rparent.parent_id != "") {
          let t = this.mod.returnTweet(rparent.parent_id);
          if (t) {
            t.critical_child = posted_tweet;
          }
        }

        rparent.critical_child = posted_tweet;
        rparent.forceRenderWithCriticalChild();
      }
    } else {

      this.mod.addTweet(newtx, true);
      posted_tweet.render(true);
    }

    //We let the loader run for a half second to show we are sending the tweet
    setTimeout(() => {
      post_self.overlay.remove();
      
      /*
      This is Really f*cking annoying... I want to stay where I am in the feed if replying to someone, 
      not autoscroll to the top, but retweeting pushes the retweet at the top, and ditto for a new tweet...
      It's an art, not a science
      */
      
      if (!is_reply) {
        post_self.mod.main.scrollFeed(0);  
      }

    }, 800);
  }

  addImg(img) {
    post_self = this;
    this.app.browser.addElementToDom(
      `<div class="post-tweet-img-preview"><img src="${img}"
           /><i data-id="${
             this.images.length - 1
           }" class="fas fa-times-circle saito-overlay-closebox-btn post-tweet-img-preview-close"></i>
           </div>`,
      document.getElementById("post-tweet-img-preview-container")
    );
    this.images.push(img);

    // attach img preview event
    // event added here because img-prievew is added dynamically
    let sel = ".post-tweet-img-preview-close";
    document.querySelectorAll(sel).forEach((elem) => {
      elem.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        let array_position = e.target.getAttribute("data-id");
        e.target.parentNode.remove();
        post_self.images.splice(array_position, 1);
        document.querySelectorAll(".post-tweet-img-preview-close").forEach((el2) => {
          let array_position2 = el2.getAttribute("data-id");
          if (array_position2 > array_position) {
            el2.setAttribute("data-id", array_position2 - 1);
          }
        });
      });
    });
  }
}

module.exports = Post;
