import req from 'request-promise-native';
import {JSDOM} from 'jsdom';
import * as fs from 'fs';

class DocEntry {
  /**
   * @param {string} url
   * @param {string} body 
   */
  constructor(url, body) {
    this.url = url;
    this.body = body;
  }

  /**
   * @returns {string}
   */
  toJson() {
    return JSON.stringify({
      url: this.url,
      body: this.body
    });
  }
}

class Bot {
  /**
   * 
   * @param {fs.WriteStream} writer
   */
  constructor(writer) {
    /** @private */
    this.writer_ = writer;
    /**
     * @type {Object.<string, boolean>}
     * @private
     */
    this.queue_ = {};
    /**
     * @type {Object.<string, boolean>}
     * @private
     */
    this.done_ = {};
  }

  /**
   * 
   * @param {string} url 
   */
  start(url) {
    this.queue_[url] = true;
    this.run_(20);
  }
  run_(cnt) {
    cnt = cnt || 1;
    for (let key in this.queue_){
      this.scrape_(key);
      cnt--;
      if(cnt < 0){
        return;
      }
    }
  }
  /**
   * @param {string} url 
   */
  scrape_(url) {
    this.done_[url] = true;
    delete this.queue_[url];
    const options = {
      uri: url
    };
    req(options)
    .then((body)=>{
      const q = this.analyze_(url, body);
      this.writer_.write(q.toJson());
      this.writer_.write('\n');
      console.log("OK", url);
      this.run_();
    }, (err) => {
      const msg = err.toString().substring(0, 200);
      console.error(msg+"...");
      this.run_();
    });
  }
  /**
   * @param {string} url
   * @param {string} body
   * @private
   * @returns {DocEntry}
   */
  analyze_(url, body) {
    const doc = (new JSDOM(body)).window.document;
    const links = doc.getElementsByTagName('a');
    for(let i = 0; i < links.length; i++){
      /** @type {HTMLLinkElement} */
      const a = links[i];
      if(!(a.protocol === 'http:' || a.protocol === 'https:')){
        continue;
      }
      const nextUrl = a.protocol+"//"+a.host+a.pathname+a.search;//+a.hash;
      if(!this.done_[nextUrl]){
        this.queue_[nextUrl] = true;
      }
    }
    return new DocEntry(url, body);
  }
}
let stream = fs.createWriteStream('db.json');
stream.once('open', function(fd) {
  let bot = new Bot(stream);
  bot.start('https://ledyba.org/');
  process.on('exit', (code) => {
    stream.end();
  });
});

