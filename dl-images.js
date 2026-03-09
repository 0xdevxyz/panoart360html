const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = 'VKhWn7omcxw5pyQ2n4oJzmW2ptYnF5Fu1VQs5YAtJBv2Spite2AuiT5J';
const IMG = path.join(__dirname, 'app', 'img', 'blog');

function dl(query, filename) {
  return new Promise(function(resolve) {
    var dest = path.join(IMG, filename);
    if (fs.existsSync(dest)) { console.log('skip ' + filename); return resolve(); }
    var url = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) + '&per_page=3&orientation=landscape';
    https.get(url, { headers: { Authorization: KEY } }, function(r) {
      var d = ''; r.on('data', function(c) { d += c; }); r.on('end', function() {
        var data = JSON.parse(d);
        var photos = data.photos;
        if (!photos || photos.length === 0) { console.log('no results: ' + query); return resolve(); }
        var imgUrl = photos[0].src.large2x || photos[0].src.large;
        https.get(imgUrl, {}, function(r2) {
          var chunks = [];
          r2.on('data', function(c) { chunks.push(c); });
          r2.on('end', function() {
            var buf = Buffer.concat(chunks);
            fs.writeFileSync(dest, buf);
            console.log('ok ' + filename + ' (' + Math.round(buf.length / 1024) + 'KB)');
            resolve();
          });
        }).on('error', function() { resolve(); });
      });
    }).on('error', function() { resolve(); });
  });
}

var images = [
  ['google maps city local business street sign', 'blog-local-seo-hero.jpg'],
  ['local business owner smartphone google search', 'blog-local-seo-card.jpg'],
  ['google search smartphone screen review stars', 'blog-gmb-hero.jpg'],
  ['google search results laptop office', 'blog-gmb-card.jpg'],
  ['website pricing budget calculator laptop money', 'blog-kosten-hero.jpg'],
  ['web design agency computer screen creative', 'blog-kosten-card.jpg']
];

(function next(i) {
  if (i >= images.length) { console.log('done'); return; }
  dl(images[i][0], images[i][1]).then(function() { next(i + 1); });
}(0));
